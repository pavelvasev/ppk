"""
Коммуникация query и т.п.

F-LINK-SUGAR
crit заменить на возможность указать каналы
crit заменить на возможность указать объекты. первый дает output второй input

"""

import asyncio
import json
import os

class LinkFeature:

    def __init__(self,rapi):
        self.rapi = rapi
        rapi.link = self.link
        rapi.bind = self.link_sync
        rapi.operations.do_forward = self.do_forward

    # todo добавить отмену

    async def link( self, src_crit, tgt_crit):
        # F-LINK-SUGAR
        if hasattr( src_crit, "output"):
            src_crit = src_crit.output
        if hasattr( tgt_crit, "input"):
            tgt_crit = tgt_crit.input
        if hasattr( src_crit, "id"):
            src_crit = src_crit.id
        if hasattr( tgt_crit, "id"):
            tgt_crit = tgt_crit.id            
        return await self.rapi.reaction( src_crit, self.rapi.operation("do_forward",target_label=tgt_crit) )

    async def do_forward( self,msg, arg):        
        #print("do_forward called, msg=",str(msg),"arg=",str(arg))
        msg["label"] = arg["target_label"]
        await self.rapi.msg( msg )

    # F-PYTHON-SYNC
    def link_sync( self, src_crit, tgt_crit):
        t = self.link( src_crit, tgt_crit )
        self.rapi.add_async_item( t )