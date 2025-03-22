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


class RequestReplyFeature:
    #### request
    def __init__(self,rapi):
        self.reply_query_promise = None
        self.reply_callbacks = {}
        self.request_counter = 0
        self.reply_label = None

        self.rapi = rapi        
        rapi.request = self.request        
        rapi.reply = self.reply            
        rapi.request_p = self.request_p
        rapi.request_pp = self.request_pp

    # версия с callback
    async def request( self, msg, callback ):
        self.request_counter = self.request_counter + 1
        request_id = self.request_counter
        self.reply_callbacks[ request_id ] = callback

        if self.reply_query_promise == None:
            self.reply_label = "py_replies_" + self.rapi.mkguid()
            self.reply_query_promise = self.rapi.query( self.reply_label, self.on_reply )
            await self.reply_query_promise

        msg["reply_msg"] = {"label": self.reply_label, "request_id": request_id }
        #print("request: debug meth",msg)
        return await self.rapi.msg( msg ) # а нужен ли тут await?

    # версия с обещаниями        
    # возвращает обещание
    async def request_p( self,msg ):
        f = asyncio.Future()
        def on_response(value):
            """
            print("GOT RESPONSE< SETTING F",f,"value=",value)
            if f.done():
                print("BTW IT RESOLVED! ",f.result())
            else:
                print("f is not finished")
            """   

            f.set_result( value )


        await self.request( msg, on_response )
        return f

    # версия с результатом обещания сразу же
    # возвращает результат обещания, т.е. ответ от сервера
    async def request_pp( self,msg ):        
        f = await self.request_p( msg )
        await f
        return f.result()

    # пришел реплай на наш запрос    
    async def on_reply( self, reply_msg ):
        #print("reply_msg",reply_msg,type(reply_msg))
        k = reply_msg["request_id"]
        #print("k=",k)
        cb = self.reply_callbacks[ reply_msg["request_id"] ]

        if cb is None:
            print("warning: reply_callback not found for reply msg",reply_msg)
        if "payload" in reply_msg:
            reply_msg["result"]["payload"] = reply_msg["payload"]
        res = cb( reply_msg["result"] )
        if inspect.isawaitable(res): 
            await res
        #
        #lambda msg: callback( msg["result"] )
           

    async def reply( self, input_msg, data ):
        # для юзабилити. надоело просто снаружи это проверять
        # как вариант, можно какой-то флаг вернуть
        if not "reply_msg" in input_msg:
            return

        output_msg = dict(input_msg["reply_msg"])
        
        output_msg["result"] = data
        if isinstance( data,dict ) and "payload" in data:
            output_msg["payload"] = data["payload"]
            del data["payload"]
        """    
        if "tobytes" in data:
            output_msg["attach"] = data
        else:
            
        """    
        return await self.rapi.msg( output_msg )
