import os
import time
import asyncio
import httpx
from fastapi import APIRouter, HTTPException

REST = os.environ["BINANCE_REST"]
router = APIRouter(prefix="/api/market")
client = httpx.AsyncClient(base_url=REST, timeout=15, headers={"User-Agent": "epochveras"})
_cache = {}
INTERVALS = {"1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d", "1w"}
_locks = {}


async def get_json(path, params=None, ttl=0):
    key = (path, tuple(sorted((params or {}).items())))
    hit = _cache.get(key)
    if ttl and hit and time.time() - hit[0] < ttl:
        return hit[1]
    lock = _locks.setdefault(key, asyncio.Lock())
    async with lock:
        hit = _cache.get(key)
        if ttl and hit and time.time() - hit[0] < ttl:
            return hit[1]
        r = await client.get(path, params=params)
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Binance {r.status_code}: {r.text[:200]}")
        data = r.json()
        if ttl:
            _cache[key] = (time.time(), data)
        return data


def _decimals(step: str) -> int:
    s = step.rstrip("0")
    return len(s.split(".")[1]) if "." in s else 0


async def symbols():
    info = await get_json("/fapi/v1/exchangeInfo", ttl=600)
    funding = await get_json("/fapi/v1/fundingInfo", ttl=600)
    fmap = {f["symbol"]: f.get("fundingIntervalHours", 8) for f in funding}
    out = []
    for s in info["symbols"]:
        if s["status"] != "TRADING" or s["quoteAsset"] != "USDT":
            continue
        commodity = s["contractType"] == "TRADIFI_PERPETUAL" and s.get("underlyingType") == "COMMODITY"
        if s["contractType"] != "PERPETUAL" and not commodity:
            continue
        tick = next((f["tickSize"] for f in s["filters"] if f["filterType"] == "PRICE_FILTER"), "0.01")
        out.append({
            "symbol": s["symbol"], "base": s["baseAsset"], "tick": tick,
            "precision": _decimals(tick), "fundingHours": fmap.get(s["symbol"], 8),
            "category": "commodity" if commodity else "crypto",
        })
    return out


@router.get("/symbols")
async def get_symbols():
    return await symbols()


@router.get("/tickers")
async def tickers():
    t24, prem = await asyncio.gather(get_json("/fapi/v1/ticker/24hr", ttl=3), get_json("/fapi/v1/premiumIndex", ttl=3))
    pmap = {p["symbol"]: p for p in prem}
    out = {}
    for t in t24:
        p = pmap.get(t["symbol"], {})
        out[t["symbol"]] = {"c": t["lastPrice"], "P": t["priceChangePercent"], "qv": t["quoteVolume"],
                            "r": p.get("lastFundingRate"), "T": p.get("nextFundingTime")}
    return out


@router.get("/klines")
async def klines(symbol: str, interval: str, limit: int = 1500, endTime: int | None = None):
    if interval not in INTERVALS:
        raise HTTPException(status_code=400, detail="Invalid interval")
    params = {"symbol": symbol.upper(), "interval": interval, "limit": min(limit, 1500)}
    if endTime:
        params["endTime"] = endTime
    rows = await get_json("/fapi/v1/klines", params)
    return [[r[0], r[1], r[2], r[3], r[4], r[5]] for r in rows]


@router.get("/futures/{symbol}")
async def futures_data(symbol: str, period: str = "5m"):
    sym = symbol.upper()
    q = {"symbol": sym, "period": period, "limit": 1}
    prem, oi, acc, top, oih, tacc = await asyncio.gather(
        get_json("/fapi/v1/premiumIndex", {"symbol": sym}, ttl=3),
        get_json("/fapi/v1/openInterest", {"symbol": sym}, ttl=5),
        get_json("/futures/data/globalLongShortAccountRatio", q, ttl=30),
        get_json("/futures/data/topLongShortPositionRatio", q, ttl=30),
        get_json("/futures/data/openInterestHist", q, ttl=30),
        get_json("/futures/data/topLongShortAccountRatio", q, ttl=30),
        return_exceptions=True,
    )
    ok = lambda x: None if isinstance(x, Exception) else x
    prem, oi, acc, top, oih, tacc = map(ok, (prem, oi, acc, top, oih, tacc))
    return {
        "symbol": sym,
        "markPrice": prem and prem.get("markPrice"),
        "fundingRate": prem and prem.get("lastFundingRate"),
        "nextFundingTime": prem and prem.get("nextFundingTime"),
        "openInterest": oi and oi.get("openInterest"),
        "openInterestValue": oih[0]["sumOpenInterestValue"] if oih else None,
        "account": acc[0] if acc else None,
        "top": top[0] if top else None,
        "topAccount": tacc[0] if tacc else None,
    }


async def last_prices():
    rows = await get_json("/fapi/v1/ticker/price", ttl=1)
    return {r["symbol"]: float(r["price"]) for r in rows}
