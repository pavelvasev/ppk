#!/bin/env python3

import asyncio
import ppk
import os

async def main(rapi):
	print("=========== app2: connected to server")

	print("=========== app2: sending messages to topic `test2`")
	for sigma in range(10):
		print("=========== app2: sending message sigma=",sigma)
		await rapi.msg( {"label":"test2","sigma":sigma} )

	await asyncio.Future()

ppk.start( main,server_url=os.environ["SERVER_URL"] )
