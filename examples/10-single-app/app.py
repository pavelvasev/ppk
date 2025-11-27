#!/bin/env python3

import asyncio
import ppk

async def main(rapi):

	def callback(msg):
		print("callback called! msg=",msg)
	
	print("=========== installing query to topic `test2`")
	await rapi.query( "test2",callback )
	print("=========== sending message to topic `test2`")
	await rapi.msg( {"label":"test2","sigma":5} )

	print("============ done")	

ppk.start( main )

