#!/bin/env python3.9

import asyncio
import ppk
import os

async def main(rapi):
	print("=========== app2: connected to server")

	async def callback(msg):		
		print("app2: callback called! msg=",msg)
		print("app2: sending messages to topic `test2`")
		for i in range(10):
			sigma = i + msg['start']
			print("=========== app2: sending message sigma=",sigma)
			await rapi.msg( {"label":"test2","sigma":sigma} )
	
	print("=========== app2: installing query to topic `test1`")
	await rapi.query( "test1",callback )

	await asyncio.Future()

ppk.start( main,server_url=os.environ["SERVER_URL"] )
