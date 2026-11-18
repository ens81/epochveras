import os
import json
import asyncio
import logging
from datetime import datetime, timezone
import websockets
from pywebpush import webpush, WebPushException
try:
    from backend.market import last_prices
except ModuleNotFoundError:
    from market import last_prices

log = logging.getLogger("alarms")
WS = os.environ["BINANCE_WS"]


class Hub:
    def __init__(self):
        self.conns = {}

    def add(self, uid, ws, cid):
        self.conns.setdefault(uid, set()).add((ws, cid))

    def remove(self, uid, ws, cid):
        self.conns.get(uid, set()).discard((ws, cid))

    async def send(self, uid, msg, exclude=None):
        for ws, cid in list(self.conns.get(uid, ())):
            if cid == exclude:
                continue
            try:
                await ws.send_json(msg)
            except Exception:
                self.remove(uid, ws, cid)


class AlarmEngine:
    def __init__(self, db, hub):
        self.db, self.hub = db, hub
        self.alarms = {}
        self.ws = None
        self.subscribed = set()
        self.prices = {}
        self.req_id = 1

    async def load(self):
        self.alarms = {}
        async for a in self.db.alarms.find({"status": "active"}, {"_id": 0}):
            self.alarms.setdefault(a["symbol"], {})[a["id"]] = a

    def add(self, a):
        self.alarms.setdefault(a["symbol"], {})[a["id"]] = a
        asyncio.create_task(self.sync_subs())

    def remove(self, a):
        self.alarms.get(a["symbol"], {}).pop(a["id"], None)
        asyncio.create_task(self.sync_subs())

    async def sync_subs(self):
        if not self.ws:
            return
        want = {s for s, m in self.alarms.items() if m}
        add, rem = want - self.subscribed, self.subscribed - want
        try:
            if add:
                self.req_id += 1
                await self.ws.send(json.dumps({"method": "SUBSCRIBE", "params": [f"{s.lower()}@aggTrade" for s in add], "id": self.req_id}))
            if rem:
                self.req_id += 1
                await self.ws.send(json.dumps({"method": "UNSUBSCRIBE", "params": [f"{s.lower()}@aggTrade" for s in rem], "id": self.req_id}))
            self.subscribed = want
        except Exception as e:
            log.warning(f"sub sync failed: {e}")

    async def catch_up(self):
        try:
            prices = await last_prices()
            for sym in list(self.alarms):
                if sym in prices:
                    await self.on_price(sym, prices[sym])
        except Exception as e:
            log.warning(f"catch-up failed: {e}")

    async def run(self):
        await self.load()
        while True:
            try:
                async with websockets.connect(f"{WS}/ws", ping_interval=20, max_size=2**22) as ws:
                    self.ws, self.subscribed = ws, set()
                    await self.sync_subs()
                    await self.catch_up()
                    async for raw in ws:
                        m = json.loads(raw)
                        if m.get("e") == "aggTrade":
                            await self.on_price(m["s"], float(m["p"]))
            except asyncio.CancelledError:
                raise
            except Exception as e:
                log.warning(f"alarm stream error: {e}")
            self.ws = None
            await asyncio.sleep(2)

    async def on_price(self, sym, p):
        self.prices[sym] = p
        bucket = self.alarms.get(sym)
        if not bucket:
            return
        hits = [a for a in bucket.values() if (a["direction"] == "up" and p >= a["price"]) or (a["direction"] == "down" and p <= a["price"])]
        for a in hits:
            bucket.pop(a["id"], None)
            asyncio.create_task(self.fire(a, p))
        if hits and not bucket:
            asyncio.create_task(self.sync_subs())

    async def fire(self, a, p):
        now = datetime.now(timezone.utc).isoformat()
        res = await self.db.alarms.update_one({"id": a["id"], "status": "active"},
                                              {"$set": {"status": "triggered", "triggered_at": now, "trigger_price": p}})
        if not res.modified_count:
            return
        a = {**a, "status": "triggered", "triggered_at": now, "trigger_price": p}
        await self.hub.send(a["user_id"], {"type": "alarm_triggered", "alarm": a})
        await self.push(a["user_id"], {"title": f"{a['symbol']} alarm", "body": f"Fiyat {a['price_str']} seviyesine ulaştı", "tag": a["id"]})

    async def push(self, uid, payload):
        async for sub in self.db.push_subs.find({"user_id": uid}, {"_id": 0}):
            try:
                await asyncio.to_thread(
                    webpush, subscription_info=sub["subscription"], data=json.dumps(payload),
                    vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
                    vapid_claims={"sub": os.environ["VAPID_SUBJECT"]}, ttl=3600,
                )
            except WebPushException as e:
                code = getattr(e.response, "status_code", None)
                if code in (404, 410):
                    await self.db.push_subs.delete_one({"endpoint": sub["endpoint"]})
                log.warning(f"push failed {code}")
            except Exception as e:
                log.warning(f"push error {e}")
