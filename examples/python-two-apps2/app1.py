#!/bin/env python3.9

import asyncio
import ppk
import os

async def main(rapi):
	print("=========== app1: connected to server")

	def callback(msg):
		print("app1: callback called! msg=",msg)
	
	print("=========== app1: installing query to topic `test2`")
	await rapi.query( "test2",callback )

	s = 0
	while True:
		await asyncio.sleep(5)
		print("=========== app1: sending messages to topic `test1`")
		await rapi.msg( {"label":"test1","start":s} )
		s = s + 100

ppk.start( main,server_url=os.environ["SERVER_URL"] )
