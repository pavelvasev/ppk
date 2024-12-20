#!/bin/env python3.9

import asyncio
import ppk
import time
import sys
import os
import matplotlib.pyplot as plt
import io

rapi = ppk.Client()

def create_plot_binary(data):
    """
    Создает график на основе входного массива и возвращает его в виде двоичных данных PNG
    
    Parameters:
    data (list/numpy.array): Одномерный массив чисел
    
    Returns:
    bytes: Двоичные данные изображения в формате PNG
    """
    # Создаем новую фигуру
    plt.figure(figsize=(10, 6))
    
    # Создаем график
    plt.plot(data, linewidth=2)
    
    # Добавляем сетку
    plt.grid(True)
    
    # Добавляем подписи осей
    plt.xlabel('Index')
    plt.ylabel('Value')
    
    # Добавляем заголовок
    plt.title('Data Plot')
    
    # Создаем буфер в памяти для сохранения изображения
    buf = io.BytesIO()
    
    # Сохраняем график в буфер в формате PNG
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    
    # Очищаем текущую фигуру
    plt.close()
    
    # Получаем двоичные данные
    binary_data = buf.getvalue()
    
    # Закрываем буфер
    buf.close()
    plt.clf() 
    
    return binary_data

async def main():
    url = os.environ["PPK_URL"]
    print("worker connecting to",url)
    await rapi.connect( url=url )
    print("connected")

    input = rapi.channel( os.environ["PPK_INPUT_CHANNEL"] )
    output = rapi.channel( os.environ["PPK_OUTPUT_CHANNEL"] )

    async def qcb(msg):
        print("worker has message! msg=",msg)
        #output.put( msg * 2 )
        arg = msg["arg"]
        image = create_plot_binary( arg )
        await rapi.reply( msg, {"content_type":"image/png","payload":image} )

    input.react( qcb )

    await asyncio.sleep( 1*100000 )
    print("Exiting")
    await c.exit()
    await s.exit()

loop = asyncio.get_event_loop()
loop.run_until_complete( main() )
# loop.run_until_complete( c.t1 )
loop.close()
