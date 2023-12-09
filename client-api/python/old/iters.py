# попытка сделать итераторы. но оказалось работа с асинхр итераторами это надо запускать их как отдельную задачу чтоб не ждать. неудобно.
#### iters

    def query2(self,crit,N=-1):
        return self.query2iterator(crit,N,self)

    # @asynccontextmanager
    # https://bbc.github.io/cloudfit-public-docs/asyncio/asyncio-part-3.html
    class query2iterator():
        # constructor, define some state
        def __init__(self,crit,N,rapi):
            self.counter = N
            self.next_msg = asyncio.Future()
            self.q = None            
            self.rapi = rapi
            self.crit = crit
     
        # create an instance of the iterator
        def __aiter__(self):
            return self
     
        # return the next awaitable
        async def __anext__(self):
            if self.q == None:
                self.q = True
                await self.rapi.query( self.crit, self.put_next_msg, self.counter)
            # check for no further items
            self.counter = self.counter - 1
            if self.counter == -1:
                raise StopAsyncIteration

            msg = await self.next_msg
            #print("!!!!!!!!!!!!!!!!!!! msg awaited",msg)
            self.next_msg = asyncio.Future()
            return msg

        def put_next_msg( self, msg ):
            #print("putnextmsg called",msg)
            self.next_msg.set_result( msg )

    def request2(self,msg,N=1):
        return self.request2iterator(msg,N,self)

    # @asynccontextmanager
    class requestd2iterator():
        # constructor, define some state
        def __init__(self,msg,N,rapi):
            self.counter=N
            self.next_msg = asyncio.Future()
            self.q = None            
            self.rapi = rapi
            self.msg = msg
     
        # create an instance of the iterator
        def __aiter__(self):
            return self
     
        # return the next awaitable
        async def __anext__(self):
            if self.q == None:
                self.q = True
                print("sending request",self.msg)
                await self.rapi.request( self.msg, self.put_next_msg )
            # check for no further items
            self.counter = self.counter - 1
            if self.counter == -1:
                raise StopAsyncIteration

            msg = self.next_msg
            #print("!!!!!!!!!!!!!!!!!!! msg awaited",msg)
            self.next_msg = asyncio.Future()
            return msg

        def put_next_msg( self, msg ):
            #print("putnextmsg called",msg)
            self.next_msg.set_result( msg )     