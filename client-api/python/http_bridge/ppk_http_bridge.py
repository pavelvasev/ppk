"""
супермега фича #F-HTTP-BRIDGE
возможность слать запросы по http и это
1) положить в канал
2) послать request

идеи
подписку на канал бы разовую.. может быть даже в форме хука
можно даже и не разовую тогда уж а сколько надо. ну т.е.
размещение query с последующей отправкой результатов.
"""

import asyncio
import websockets
from websockets.server import serve
import ppk
from aiohttp import web
import aiohttp
import json

# делаем мост из http в ppk
# rapi это rapi
# app это web.Application()
def setup_http_ppk_bridge( rapi, app ):

    async def ppk_put(request):
        # https://stackoverflow.com/questions/39449739/aiohttp-how-to-retrieve-the-data-body-in-aiohttp-server-from-requests-get
        # можно бы и json если что читать
        #data = await request.read()
        params = request.rel_url.query
        print("ppk put, params=",params)
        label = params["label"]
        value = params["value"]
        ch_value = json.loads(value)
        print("channel value",ch_value)

        #send_ch = rapi.channel( label )
        await rapi.msg( {"label":label, "value":ch_value} )

        #api_run_resp_ch = rapi.channel(f"api_run/response_{cnt}")

        nocache = {"Cache-Control":"no-cache, no-store, must-revalidate",
                   "Pragma": "no-cache",
                   "Expires": "0"}
        result = "ok"
        return aiohttp.web.Response(text=result,content_type='text/plain',headers=nocache)

    async def ppk_request(request):
        # https://stackoverflow.com/questions/39449739/aiohttp-how-to-retrieve-the-data-body-in-aiohttp-server-from-requests-get
        # можно бы и json если что читать
        #data = await request.read()
        params = request.rel_url.query
        print("ppk request, params=",params)
        label = params["label"]
        value = params["value"]
        ch_value = json.loads(value)
        print("channel value",ch_value)

        finish_future = asyncio.Future()

        def on_reply(response_msg):
            nocache = {"Cache-Control":"no-cache, no-store, must-revalidate",
                       "Pragma": "no-cache",
                       "Expires": "0"}
            #print("http-bridge: got response_msg=",response_msg)

            response_args = {}
            response_args['content_type'] = 'text/plain'
            if "content_type" in response_msg:
            	response_args['content_type'] = response_msg["content_type"]

            payload = None            
            if "payload" in response_msg:
            	payload = response_msg["payload"]
            	response_args["body"] = payload
            else:
            	# json?
            	result = str(response_msg)
            	response_args["text"] = result

            web_response = aiohttp.web.Response(**response_args,headers=nocache)
            nonlocal finish_future
            finish_future.set_result( web_response )

        #send_ch = rapi.channel( label )
        await rapi.request( {"label":label, "arg":ch_value},on_reply )
        web_response = await finish_future
        return web_response

    app.router.add_get("/put", ppk_put)
    app.router.add_get("/req", ppk_request)

