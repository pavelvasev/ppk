#!/bin/env python3

import asyncio
import ppk
import os

async def main(rapi):
	print("============== server started. url=",rapi.server_url)
	await asyncio.Future()

ppk.start(main,port=os.environ["SERVER_PORT"])