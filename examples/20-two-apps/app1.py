#!/bin/env python3

import asyncio
import ppk
import os

async def main(rapi):
	print("=========== app1: connected to server")

	def callback(msg):
		print("app1: callback called! msg=",msg)
	
	print("=========== app1: installing query to topic `test2`")
	await rapi.query( "test2",callback )

	await asyncio.Future()

ppk.start( main,server_url=os.environ["SERVER_URL"] )
