#!/bin/env python3.9

import asyncio
import ppk
import os,sys

async def main(rapi):
	print("=========== worker: connected to server")
	WORKER_ID=sys.argv[1] # todo change to main arg
	rapi.sender = WORKER_ID
	print("WORKER_ID=",WORKER_ID)

	async def callback(msg):		
		print("worker: callback called! msg=",msg)
		print("worker: sending messages to topic `test2`")
		for i in range(2):
			sigma = i + msg['start']
			print("=========== worker: sending message sigma=",sigma)
			await rapi.msg( {"label":"test2","sigma":sigma} )
	
	print("=========== worker: installing query to topic `test1`")
	await rapi.query( "test1",callback )

	await asyncio.Future()

ppk.start( main,server_url=os.environ["SERVER_URL"] )
