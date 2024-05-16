"""
Коммуникация query и т.п.
"""

import asyncio
import json
import os
import aiofiles
import atexit 
import traceback
import inspect
# вообще спорно. ну ладно. для get_payload надо
import numpy as np
import sys

class QueryTicker:
    """Yield numbers from 0 to `to` every `delay` seconds."""

    def __init__(self, rapi, crit, N):
        self.rapi = rapi        
        self.inited = False
        self.crit = crit
        self.N = N

    def on_data22(self,msg):
        #print("query_for data arrive",msg)
        self.promisa.set_result( msg )

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self.inited:
            self.inited = True
            self.promisa = asyncio.Future()    
            await self.rapi.query( self.crit, self.on_data22, self.N)

        await self.promisa
        res = self.promisa.result()
        self.promisa = asyncio.Future()
        return res
        #    raise StopAsyncIteration

# old: s--- 4 байта длина строки, 4 байта длина attach, и далее строка с json и массив байт attach
# 4 байта query_id, 4 байта длина строки, и далее строка с json 
class QueryFor:

    def __init__(self,rapi):
        self.rapi = rapi
        rapi.query_for = self.query_for
    """
    async for msg in rapi.query_for( self.id ):
        print("msg",msg)
    """

    # https://peps.python.org/pep-0525/
    # https://docs.python.org/3/reference/expressions.html#yieldexpr
    def query_for( self, crit, N=-1):
        return QueryTicker(self.rapi, crit, N)

