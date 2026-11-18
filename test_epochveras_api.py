"""Epochveras backend regression tests: market proxy, auth, settings, drawings, alarms, WS, push."""
import os
import json
import time
import uuid
import asyncio
import subprocess
import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")


def _user(email):
    out = subprocess.check_output(["python3", "/app/scripts/clerk_test_user.py", email], text=True)
    return json.loads(out.strip().splitlines()[-1])


@pytest.fixture(scope="module")
def u1():
    return _user("trader+clerk_test@example.com")


@pytest.fixture(scope="module")
def u2():
    return _user("other+clerk_test@example.com")


def H(u, cid=None):
    h = {"Authorization": f"Bearer {u['token']}", "Content-Type": "application/json"}
    if cid:
        h["X-Client-Id"] = cid
    return h


def btc_price():
    return float(requests.get(f"{BASE_URL}/api/market/tickers", timeout=20).json()["BTCUSDT"]["c"])


# --- Market proxy ---
class TestMarket:
    def test_symbols(self):
        r = requests.get(f"{BASE_URL}/api/market/symbols", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d) > 400
        m = {s["symbol"]: s for s in d}
        assert "BTCUSDT" in m and m["BTCUSDT"]["precision"] == 1
        assert "XAUUSDT" in m and m["XAUUSDT"]["category"] == "commodity"
        assert all(k in m["BTCUSDT"] for k in ("tick", "precision", "fundingHours", "category"))
        assert any(s["fundingHours"] == 4 for s in d)

    def test_tickers(self):
        r = requests.get(f"{BASE_URL}/api/market/tickers", timeout=30)
        assert r.status_code == 200
        t = r.json()["BTCUSDT"]
        assert float(t["c"]) > 0 and "P" in t and "qv" in t and t["r"] is not None

    def test_klines(self):
        r = requests.get(f"{BASE_URL}/api/market/klines", params={"symbol": "BTCUSDT", "interval": "15m"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d) == 1500 and len(d[0]) == 6

    @pytest.mark.parametrize("tf", ["1m", "3m", "5m", "30m", "1h", "4h", "1d", "1w"])
    def test_klines_all_tf(self, tf):
        r = requests.get(f"{BASE_URL}/api/market/klines", params={"symbol": "BTCUSDT", "interval": tf, "limit": 10}, timeout=30)
        assert r.status_code == 200 and len(r.json()) == 10

    def test_klines_bad_interval(self):
        r = requests.get(f"{BASE_URL}/api/market/klines", params={"symbol": "BTCUSDT", "interval": "7m"}, timeout=30)
        assert r.status_code == 400

    def test_futures(self):
        r = requests.get(f"{BASE_URL}/api/market/futures/BTCUSDT", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("markPrice", "fundingRate", "nextFundingTime", "openInterest", "openInterestValue", "account", "top", "topAccount"):
            assert d[k] is not None, k
        assert "longAccount" in d["account"] and "longShortRatio" in d["top"]
        # iteration 3: top trader account ratio added
        for k in ("account", "top", "topAccount"):
            assert float(d[k]["longShortRatio"]) > 0
            assert abs(float(d[k]["longAccount"]) + float(d[k]["shortAccount"]) - 1) < 0.01

    def test_futures_periods(self):
        for p in ("15m", "1h", "1d"):
            r = requests.get(f"{BASE_URL}/api/market/futures/ETHUSDT", params={"period": p}, timeout=30)
            assert r.status_code == 200 and r.json()["topAccount"] is not None, p

    def test_vapid(self):
        r = requests.get(f"{BASE_URL}/api/push/vapid", timeout=20)
        assert r.status_code == 200 and len(r.json()["key"]) > 40


# --- Auth ---
class TestAuth:
    @pytest.mark.parametrize("path", ["/api/settings", "/api/drawings?symbol=BTCUSDT", "/api/alarms"])
    def test_401_without_token(self, path):
        assert requests.get(f"{BASE_URL}{path}", timeout=20).status_code == 401

    def test_401_bad_token(self):
        assert requests.get(f"{BASE_URL}/api/alarms", headers={"Authorization": "Bearer garbage"}, timeout=20).status_code == 401

    @pytest.mark.parametrize("path", ["/api/settings", "/api/drawings?symbol=BTCUSDT", "/api/alarms"])
    def test_200_with_token(self, u1, path):
        assert requests.get(f"{BASE_URL}{path}", headers=H(u1), timeout=20).status_code == 200


# --- Settings ---
class TestSettings:
    def test_patch_and_get(self, u2):
        body = {"favorites": {"all": ["BTCUSDT"], "groups": [{"name": "TEST_g", "symbols": ["ETHUSDT"]}]},
                "last_symbol": "ETHUSDT", "last_tf": "1h", "sound": False,
                "drawing_styles": {"trendline": {"color": "#ff0000", "width": 3}},
                "indicators": {"epoch": {"ema": True}}, "layout": {"width": 320}}
        r = requests.patch(f"{BASE_URL}/api/settings", headers=H(u2), json=body, timeout=20)
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/settings", headers=H(u2), timeout=20).json()
        for k, v in body.items():
            assert g[k] == v, k

    def test_invalid_keys(self, u2):
        r = requests.patch(f"{BASE_URL}/api/settings", headers=H(u2), json={"foo": 1}, timeout=20)
        assert r.status_code == 400

    def test_isolation(self, u1, u2):
        requests.patch(f"{BASE_URL}/api/settings", headers=H(u2), json={"last_tf": "1w"}, timeout=20)
        g1 = requests.get(f"{BASE_URL}/api/settings", headers=H(u1), timeout=20).json()
        g2 = requests.get(f"{BASE_URL}/api/settings", headers=H(u2), timeout=20).json()
        assert g2["last_tf"] == "1w"
        print("u1 last_tf", g1.get("last_tf"))


# --- Drawings ---
class TestDrawings:
    def test_crud_and_isolation(self, u1, u2):
        did = "TEST_" + uuid.uuid4().hex
        body = {"symbol": "btcusdt", "type": "trendline", "points": [{"time": 1700000000, "price": 37000.5}, {"time": 1700003600, "price": 37500.1}],
                "style": {"color": "#2962ff", "width": 2}}
        r = requests.put(f"{BASE_URL}/api/drawings/{did}", headers=H(u1), json=body, timeout=20)
        assert r.status_code == 200 and r.json()["symbol"] == "BTCUSDT" and r.json()["id"] == did
        lst = requests.get(f"{BASE_URL}/api/drawings?symbol=BTCUSDT", headers=H(u1), timeout=20).json()
        d = next(x for x in lst if x["id"] == did)
        assert d["points"][0] == {"time": 1700000000, "price": 37000.5}
        assert "user_id" not in d and "_id" not in d
        # update
        body["style"] = {"color": "#ff0000", "width": 4}
        requests.put(f"{BASE_URL}/api/drawings/{did}", headers=H(u1), json=body, timeout=20)
        lst = requests.get(f"{BASE_URL}/api/drawings?symbol=BTCUSDT", headers=H(u1), timeout=20).json()
        assert [x for x in lst if x["id"] == did][0]["style"]["width"] == 4
        assert len([x for x in lst if x["id"] == did]) == 1
        # isolation
        lst2 = requests.get(f"{BASE_URL}/api/drawings?symbol=BTCUSDT", headers=H(u2), timeout=20).json()
        assert not any(x["id"] == did for x in lst2)
        assert requests.delete(f"{BASE_URL}/api/drawings/{did}", headers=H(u2), timeout=20).status_code == 404
        # cross-user PUT must be 403 and not alter u1's drawing (iteration 2 fix)
        r403 = requests.put(f"{BASE_URL}/api/drawings/{did}", headers=H(u2), json={**body, "style": {"color": "#000", "width": 9}}, timeout=20)
        assert r403.status_code == 403
        lst = requests.get(f"{BASE_URL}/api/drawings?symbol=BTCUSDT", headers=H(u1), timeout=20).json()
        assert [x for x in lst if x["id"] == did][0]["style"]["width"] == 4
        # delete
        assert requests.delete(f"{BASE_URL}/api/drawings/{did}", headers=H(u1), timeout=20).status_code == 200
        lst = requests.get(f"{BASE_URL}/api/drawings?symbol=BTCUSDT", headers=H(u1), timeout=20).json()
        assert not any(x["id"] == did for x in lst)
        assert requests.delete(f"{BASE_URL}/api/drawings/{did}", headers=H(u1), timeout=20).status_code == 404

    def test_invalid_body(self, u1):
        r = requests.put(f"{BASE_URL}/api/drawings/TEST_bad", headers=H(u1), json={"symbol": "BTCUSDT"}, timeout=20)
        assert r.status_code == 422


# --- Alarms ---
class TestAlarms:
    def test_direction_and_delete(self, u2):
        p = btc_price()
        up = requests.post(f"{BASE_URL}/api/alarms", headers=H(u2), json={"symbol": "BTCUSDT", "price": round(p * 1.5, 1)}, timeout=20).json()
        dn = requests.post(f"{BASE_URL}/api/alarms", headers=H(u2), json={"symbol": "BTCUSDT", "price": round(p * 0.5, 1)}, timeout=20).json()
        assert up["direction"] == "up" and dn["direction"] == "down" and up["status"] == "active"
        ids = [a["id"] for a in requests.get(f"{BASE_URL}/api/alarms", headers=H(u2), timeout=20).json()]
        assert up["id"] in ids and dn["id"] in ids
        for a in (up, dn):
            assert requests.delete(f"{BASE_URL}/api/alarms/{a['id']}", headers=H(u2), timeout=20).status_code == 200
        ids = [a["id"] for a in requests.get(f"{BASE_URL}/api/alarms", headers=H(u2), timeout=20).json()]
        assert up["id"] not in ids and dn["id"] not in ids

    def test_invalid(self, u2):
        assert requests.post(f"{BASE_URL}/api/alarms", headers=H(u2), json={"symbol": "NOPEUSDT", "price": 1}, timeout=20).status_code == 400
        assert requests.post(f"{BASE_URL}/api/alarms", headers=H(u2), json={"symbol": "BTCUSDT", "price": -1}, timeout=20).status_code == 400

    def test_trigger_and_ws_and_clear(self, u2):
        async def run():
            cid = "TEST_" + uuid.uuid4().hex[:8]
            async with websockets.connect(f"{WS_URL}/api/ws?token={u2['token']}&client_id={cid}") as ws:
                p = btc_price()
                # probe for the server-side current price, then bracket it by one tick on both sides
                probe = requests.post(f"{BASE_URL}/api/alarms", headers=H(u2), json={"symbol": "BTCUSDT", "price": round(p * 3, 1)}, timeout=20).json()
                requests.delete(f"{BASE_URL}/api/alarms/{probe['id']}", headers=H(u2), timeout=20)
                cp = probe["created_price"]
                a = requests.post(f"{BASE_URL}/api/alarms", headers=H(u2), json={"symbol": "BTCUSDT", "price": round(cp + 0.1, 1)}, timeout=20).json()
                b = requests.post(f"{BASE_URL}/api/alarms", headers=H(u2), json={"symbol": "BTCUSDT", "price": round(cp - 0.1, 1)}, timeout=20).json()
                print("alarm dirs", a["direction"], a["created_price"], b["direction"], b["created_price"])
                # drawing upsert from another client id should reach this ws
                did = "TEST_" + uuid.uuid4().hex
                pr = requests.put(f"{BASE_URL}/api/drawings/{did}", headers=H(u2, "other-client"),
                                  json={"symbol": "BTCUSDT", "type": "hray", "points": [{"time": 1700000000, "price": 1}]}, timeout=20)
                assert pr.status_code == 200, pr.text
                types, trig = [], set()
                end = time.time() + 45
                while time.time() < end and not (trig and "drawing_upsert" in types):
                    try:
                        m = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
                    except asyncio.TimeoutError:
                        continue
                    types.append(m["type"])
                    if m["type"] == "alarm_triggered":
                        trig.add(m["alarm"]["id"])
                requests.delete(f"{BASE_URL}/api/drawings/{did}", headers=H(u2), timeout=20)
                return a, b, types, trig
        a, b, types, trig = asyncio.run(run())
        print("ws events", types)
        assert "drawing_upsert" in types
        assert "alarm_triggered" in types
        time.sleep(3)
        lst = {x["id"]: x for x in requests.get(f"{BASE_URL}/api/alarms", headers=H(u2), timeout=20).json()}
        trig_rows = [lst[i] for i in (a["id"], b["id"]) if lst.get(i, {}).get("status") == "triggered"]
        assert trig_rows and trig_rows[0]["trigger_price"] > 0
        # clear triggered
        assert requests.delete(f"{BASE_URL}/api/alarms", headers=H(u2), timeout=20).status_code == 200
        lst = {x["id"]: x for x in requests.get(f"{BASE_URL}/api/alarms", headers=H(u2), timeout=20).json()}
        assert not any(x["status"] == "triggered" for x in lst.values())
        for i in (a["id"], b["id"]):
            if i in lst:
                requests.delete(f"{BASE_URL}/api/alarms/{i}", headers=H(u2), timeout=20)

    def test_ws_bad_token(self):
        async def run():
            try:
                async with websockets.connect(f"{WS_URL}/api/ws?token=bad&client_id=x") as ws:
                    await asyncio.wait_for(ws.recv(), timeout=5)
                return "open"
            except Exception as e:
                return type(e).__name__
        res = asyncio.run(run())
        assert res != "open"
