import asyncio
import ppk
import json
import os
import sys

from aiohttp import web

# https://docs.python.org/3/library/webbrowser.html
"""
import webbrowser
async def start_browser( url ):
    webbrowser.open(url, new = 2)
""" 

import atexit
class Server:

    def __init__(self):
        self.finish_future = asyncio.Future()
        atexit.register(self.cleanup) # это системное..

    def cleanup(self):
        if not self.finish_future.done():
            #self.runner.cleanup()
            self.finish_future.set_result(1)
        pass

    async def exit( self ):
        #self.finish_future.set_result(1)
        #self.cleanup()
        self.runner.cleanup()
        # пододжать пока отработает
        await asyncio.sleep( 0.1 )

    async def start( self,static_routes, port=0 ):
        app = web.Application()
        # https://docs.aiohttp.org/en/stable/web_reference.html#aiohttp.web.UrlDispatcher.add_static

        # приоритет
        js_api = os.path.abspath( os.path.join( os.path.dirname(__file__), "../js" ) )
        print("js_api=",js_api)
        app.router.add_static('/ppk', js_api, append_version=True,show_index=True)

        for url in static_routes:
            app.router.add_static(url, static_routes[url], append_version=True,show_index=True)

        # https://docs.aiohttp.org/en/stable/web_reference.html#running-applications
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, '127.0.0.1', 0)
        await site.start()
        self.runner = runner
        #print(runner.server.__dict__)
        adr = site._server.sockets[0].getsockname()
        #adr = runner.server.sockets[0].getsockname()
        self.url = "http://" + adr[0] + ":" + str(adr[1])
        #self.task = asyncio.create_task( web._run_app(app) )
        
        async def do_stop():
            await self.finish_future
            await runner.cleanup()

        k = asyncio.create_task( do_stop() )

        # todo убрать это и заменить обратно на url - так удобнее клиентский вид
        # а там уже пусть connect await делает внутрях
        #return self.task
        return app
