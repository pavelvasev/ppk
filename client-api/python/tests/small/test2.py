#!/bin/env python3.9

#import client_api
import asyncio

from ppk import ppk_run

def f(msg):
	print("f action ! msg=",msg)

async def main(rapi):
	await rapi.reaction( "test", rapi.python( f ))
	print("calling msg")
	await rapi.msg( {"label":"test"} )
	#await rapi.exit()

ppk_run( main )
