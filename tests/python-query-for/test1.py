#!/bin/env python3.9

import asyncio

async def get_range():
    for i in range(10):
        print(f"start {i}")
        await asyncio.sleep(1)
        print(f"end {i}")
        yield i

class AIter:
    def __init__(self, N):
        self.i = 0
        self.N = N

    def __aiter__(self):
        return self

    async def __anext__(self):
        i = self.i
        print(f"start {i}")
        await asyncio.sleep(1)
        print(f"end {i}")
        if i >= self.N:
            raise StopAsyncIteration
        self.i += 1
        return i

async def main():
    async for p in AIter(10):
        print(f"finally {p}")

    async for p in AIter(10):
        print(f"finally111 {p}")

if __name__ == "__main__":
    asyncio.run(main())