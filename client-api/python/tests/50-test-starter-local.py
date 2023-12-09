#!/bin/env python3.9

import asyncio
import ppk

import numpy as np
c = ppk.Client()
s = ppk.LocalServer()

async def main():	
	print("starting system")
	s1 = await s.start()
	print("done, s1=",s1)
	print("starting workers")
	w1 = await s.start_workers( 2, 2, 1000 )
	print("done, w1=",w1)

	print("connecting")
	t1 = await c.connect( url=s.url )

	print("connected",t1)
	
	arr = np.array([1, 2, 3.0])
	print("arr created =",arr)
	handle = await c.add_data( arr )
	print("handle of data=",handle)

	def summer(a=0,b=0,**kwargs):
		return a+b
	
	print("subtmitting exec")
	h2 = await c.exec_request( c.python(summer,a=1,b=2) )
	h3 = await c.exec_request( c.python(summer,a=h2,b=4) )

	print("waiting exec result")
	dat = await c.get_data( h3 )
	print("result=",dat)
	#await asyncio.sleep( 5 )
	#print("cleanup")
	#s.cleanup()

	await c.exit()

import os
import signal
#os.setpgrp()	
#os.killpg(0, signal.SIGTERM)

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
loop.run_until_complete( c.t1 )
loop.close()

#asyncio.run( main() )