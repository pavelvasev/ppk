"""
Коммуникация query и т.п.
"""

import asyncio
import json
import os

class LinkFeature:

    def __init__(self,rapi):
        self.rapi = rapi
        rapi.link = self.link
        rapi.operations.do_forward = self.do_forward

    # todo добавить отмену
    async def link( self, src_crit, tgt_crit):
        return await self.rapi.reaction( src_crit, self.rapi.operation("do_forward",target_label=tgt_crit) )

    async def do_forward( self,msg, arg):        
        #print("do_forward called, msg=",str(msg),"arg=",str(arg))
        msg["label"] = arg["target_label"]
        await self.rapi.msg( msg )
