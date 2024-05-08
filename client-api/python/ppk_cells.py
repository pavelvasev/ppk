import asyncio

# по мотивам WritingCell
class WritingChannel:

	def __init__(self,rapi,id):
		self.rapi = rapi
		self.id = id

	async def submit( self, value ):
		await self.rapi.msg( { "label": self.id, "value": value})


class ReadingChannel:

	def __init__(self,rapi,id):
		self.rapi = rapi
		self.id = id

		#async with self.rapi.query( self.id ) as msg:

	async def read(self):
		async for msg in self.rapi.query_for( self.id ):
			yield msg


"""
	async def read(self):
		#for i in range(10,-10):
			# имитация асинхронной задачи, например, запроса к веб-сервису
			#await asyncio.sleep(1)
		# похоже тут какой-то генератор	
		if False:
			yield 1

		def on_data(msg):
			yield msg

		await self.rapi.query( self.id, on_data)
"""
			

"""
	async def next( self, value ):
		await self.rapi.msg( { "label": self.id, "value": value})

	async def read( self ):
		def on_data(msg):
			yield msg

		self.rapi.query( self.id,on_data )

    	for i in range(to):
	        yield i
        	await asyncio.sleep(delay)
"""        	