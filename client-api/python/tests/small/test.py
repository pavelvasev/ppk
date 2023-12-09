#!/bin/env python3.9

import asyncio
from client_api import Client
#from client_api import connect
#from client_api import ppk_run

def f(msg):
	print("f action ! msg=",msg)
	
def qcb(msg):
  print("qcb! msg=",msg)

async def main():
	c = Client()
	t1 = await c.connect()

	print("calling reaction")
	await c.reaction( "test", c.python( f ) | c.js( "msg => console.log(`f js action! msg=`,msg)" ) )
	print("calling msg")
	await c.msg( {"label":"test","sigma":5} )
	await c.query( "test2",qcb )
	await t1 # это засада - явно так его ждать.. я с ходу снизу приписал другие алгоритмы.. хех
	#await c.exit()

asyncio.run( main() )
