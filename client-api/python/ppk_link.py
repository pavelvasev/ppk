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

    # todo добавить отмену
    async def link( self, src_crit, tgt_crit):
        return await self.rapi.reaction( crit, self.rapi.operation("do_forward",target_label=tgt_crit) )
