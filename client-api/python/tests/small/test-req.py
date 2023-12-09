#!/bin/env python3.9

import asyncio
from client_api import Client
#from client_api import connect
#from client_api import ppk_run

def f(msg):
	print("f action ! msg=",msg)
	
def qcb(msg):
  print("qcb! msg=",msg)

c = Client()

async def main():	
	t1 = await c.connect()
	print("connected",t1)

	def on_m1(msg):
		print("python: test2 arrived",msg)	
	await c.query( "test2",on_m1 )

	async def on_m2(msg):
		print("python: test3 request arrived",msg)
		await c.reply( msg, 333 )
	r1 = await c.query( "test3",on_m2 )  
	print("r1=",r1)

	def on_m3(msg):
	  print("python: test3 reply arrived",msg)

	print("sensding request test3")
	await c.request({"label":"test3"}, on_m3)

	#await t1 # это засада - явно так его ждать.. я с ходу снизу приписал другие алгоритмы.. хех
	#await c.exit()


loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
loop.run_until_complete( c.t1 )
loop.close()

#asyncio.run( main() )