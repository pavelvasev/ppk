#!/usr/bin/env python3.9

import asyncio
import websockets
from websockets.server import serve
import ppk
from ppk_main import *

if __name__ == "__main__":
    ws = WebsocketSrv( ReactionsList() )
    asyncio.run(ws.main(10000))
