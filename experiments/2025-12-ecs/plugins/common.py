import os
import sys

import ppk
import ppk.genesis as gen

import numpy as np
import asyncio
import imageio

# сохраняет картинки png из указанного компонента
# todo аргумент список доп компонент, имя компоненты с картинкой
class ImageSaver:
    def __init__(self):
        self.distribution = []

    def deploy( self,workers ):
        for w in workers:
            print("deploy image_saver to worker",w.id)
            nodes = gen.node( "image_saver", tags=["ecs_system"])
            w.put( {"description":nodes,"action":"create"})


# todo 2 варианта просто рисовалка и с учетом сдвига
class image_saver:
    def __init__(self,rapi,description,parent):
        self.local_systems = description["local_systems"]
        self.local_systems.append(self)

        print("image_saver item created")

        gen.apply_description( rapi, self, description )

    def process_ecs(self,i,world):
        print("image_saver:process_ecs called")
        # todo искать указаннный в параметре компонент
        #ents = world.get_entities_with_components("image")
        ents = world.get_entities_with_components("image","final_image")
        print("image_saver:ents=",ents)
        for entity_id in ents:
            #grid = e.components["voxel_volume"]
            e = world.get_entity( entity_id )
            image = e.get_component("image")
            if not "payload" in image:
                continue
            if "image_saver_processed" in image:
                continue
            image["image_saver_processed"] = 1
            rgb = image["payload"]["rgb"]

            imageio.imwrite(f"{entity_id}_iter_{i:05d}.png", rgb)


# копирует картинки из воксельного рендеринга в мержер
# todo может это лишнее и в мержер подать на вход набор исходных энтитей
# todo список исходных энтитей это аргумент
# idea может быть это универсальный линк кстати и там набор целевых итемов
# кстати это классная идея - вот можно будет массово линковать процессы обработки
# информации а точнее их энтити. это хорошо!№
class PassImagesToMerger:
    def __init__(self,rapi,total):
        self.total = total
        self.rapi=rapi

    def deploy( self,workers ):
        for i in range(self.total):
            src = f"vv_{i:04d}/image/out"
            tgt = f"image_merge_level0_{i}/image/in"
            print("ENTITY COMPONENT BIND",src,"----->",tgt)
            self.rapi.bind(src,tgt)


# соединяет картинки на основе з-буфера
# чтобы мержер заработал
# должна быть проведена запись в энтити
# f"image_merge_level0_{i}"
# в компоненту image

# level0 соответствует исходному разбиению данных и рендеринга,
# имеет вход image и он пересылает на level1 на image1/2
class ImageMerger:
    def __init__(self,rapi,total):
        self.distribution = []
        self.total=total
        self.rapi = rapi
        self.final_ch = rapi.channel("final_image_ready")

    def deploy( self,workers ):

        level = 0
        items_on_level = self.total

        while items_on_level > 0:
            print("ImageMerger generating level",level,"items_on_level=",items_on_level)

            for i in range(items_on_level):
                entity_id = f"image_merge_level{level}_{i}"
                nodes = gen.node( "entity",
                            maybe_components=["image","image1","image2"],
                            components={
                              "image_merge_entity": dict(),
                            },
                            entity_id=entity_id
                            )
                if items_on_level == 1:
                    # ставим отметку что это финальная картинка
                    nodes["params"]["components"]["final_image"] = dict()
                    self.rapi.bind(f"{entity_id}/image_done/out",self.final_ch)

                n =  i % len(workers)
                print("deploy image_merge entity ",entity_id,"to worker",n)
                workers[n].put( {"description":nodes,"action":"create"} )

                if items_on_level > 1:
                    # если это не финальная картинка то
                    # ссылка на следующую энтити
                    next_entity_id = f"image_merge_level{level+1}_{i//2}"
                    next_input = ["image1","image2"][i % 2]
                    src = f"{entity_id}/image/out"
                    tgt = f"{next_entity_id}/{next_input}/in"
                    print("ENTITY COMPONENT BIND",src,"----->",tgt)
                    self.rapi.bind(src,tgt)

            items_on_level = items_on_level // 2
            level = level + 1

        for w in workers:
            print("deploy image_merger to worker",w.id)
            nodes = gen.node( "image_merger", tags=["ecs_system"])
            w.put( {"description":nodes,"action":"create"})


def merge_by_depth(
    rgb_a: np.ndarray,
    depth_a: np.ndarray,
    rgb_b: np.ndarray,
    depth_b: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """
    Объединяет два изображения по z-буферу.

    На каждом пикселе выбирается цвет того изображения, у которого глубина меньше
    (ближе к камере). Предполагается, что меньший z = ближе.

    Параметры
    ---------
    rgb_a : np.ndarray
        Цвета первого изображения [H, W, 3], dtype=uint8.
    depth_a : np.ndarray
        z-буфер первого изображения [H, W], dtype=float32.
    rgb_b : np.ndarray
        Цвета второго изображения [H, W, 3], dtype=uint8.
    depth_b : np.ndarray
        z-буфер второго изображения [H, W], dtype=float32.

    Возвращает
    ----------
    rgb : np.ndarray
        Итоговый цвет [H, W, 3], uint8.
    depth : np.ndarray
        Итоговый z-буфер [H, W], float32.
    """

    if rgb_a.shape != rgb_b.shape:
        raise ValueError(f"rgb_a.shape {rgb_a.shape} != rgb_b.shape {rgb_b.shape}")
    if depth_a.shape != depth_b.shape:
        raise ValueError(f"depth_a.shape {depth_a.shape} != depth_b.shape {depth_b.shape}")
    if rgb_a.shape[:2] != depth_a.shape:
        raise ValueError("Пространственные размеры rgb и depth не совпадают")

    # Маска: где второе изображение ближе (depth_b < depth_a)
    mask_b_closer = depth_b < depth_a  # [H, W], bool

    # Расширяем маску до [H, W, 1] для работы с цветом
    mask_b_closer_3 = mask_b_closer[..., None]

    # Выбираем глубины
    depth_out = np.where(mask_b_closer, depth_b, depth_a).astype(np.float32)

    # Выбираем цвета
    rgb_out = np.where(mask_b_closer_3, rgb_b, rgb_a).astype(np.uint8)

    return rgb_out, depth_out


def compose_rgb_depth(
    list_rgb,
    list_depth,
    bg_color=(0, 0, 0),
    empty_depth_value=0.0,
):
    """
    Объединяет несколько кадров (rgb + depth) в один по минимальному z.

    Параметры
    ---------
    list_rgb : list[np.ndarray]
        Список кадров цвета, каждый массив формы:
        - [H, W, 3] uint8 (RGB), или
        - [H, W, 4] uint8 (RGBA).
    list_depth : list[np.ndarray]
        Список depth-карт, каждый массив формы [H, W] float32.
        Допущение: depth <= 0 или NaN означает «нет геометрии» (фон).
    bg_color : tuple(int, int, int)
        Цвет фона (R, G, B) в диапазоне 0–255.
    empty_depth_value : float
        Значение глубины в итоговой карте для пикселей, где ни на одном
        входном кадре нет геометрии.

    Возвращает
    ----------
    out_rgb : np.ndarray
        Итоговый цвет [H, W, 3] uint8.
    out_depth : np.ndarray
        Итоговый z-буфер [H, W] float32.
    """
    if not list_rgb or not list_depth:
        raise ValueError("list_rgb и list_depth не должны быть пустыми")
    if len(list_rgb) != len(list_depth):
        raise ValueError("list_rgb и list_depth должны быть одинаковой длины")

    # Стек RGB (обрежем альфу, если есть)
    rgb_stack = np.stack(
        [img[..., :3] for img in list_rgb],
        axis=0
    )  # [N, H, W, 3]

    # Стек depth
    depth_stack = np.stack(list_depth, axis=0)  # [N, H, W]

    # Маска «есть геометрия» (depth > 0 и не NaN)
    has_geom = (depth_stack > 0) & np.isfinite(depth_stack)

    # Там, где геометрии нет, подставляем +inf, чтобы не выигрывало при argmin
    depth_clean = np.where(has_geom, depth_stack, np.inf)

    # Индексы минимальной глубины по каждому пикселю
    idx_min = np.argmin(depth_clean, axis=0)  # [H, W]
    min_depth = depth_clean[idx_min, np.arange(depth_clean.shape[1])[None, :]]

    # Общая маска: есть ли хоть один источник с геометрией для этого пикселя
    any_geom = np.isfinite(min_depth)

    h, w, _ = rgb_stack.shape[1:]
    out_rgb = np.zeros((h, w, 3), dtype=rgb_stack.dtype)
    out_rgb[:] = bg_color

    out_depth = np.full((h, w), empty_depth_value, dtype=depth_stack.dtype)

    # Заполняем по источникам
    for i in range(len(list_rgb)):
        mask = (idx_min == i) & any_geom
        if not np.any(mask):
            continue
        out_rgb[mask] = rgb_stack[i][mask]
        out_depth[mask] = depth_stack[i][mask]

    return out_rgb, out_depth   


class image_merger:
    def __init__(self,rapi,description,parent):
        self.local_systems = description["local_systems"]
        self.local_systems.append(self)

        print("image_merger item created")

        gen.apply_description( rapi, self, description )

    def process_ecs(self,i,world):
        print("image_merger:process_ecs called")
        # todo искать указаннный в параметре компонент
        ents = world.get_entities_with_components("image1","image2")
        print("image_merger:ents=",ents)
        for entity_id in ents:
            #grid = e.components["voxel_volume"]
            print("processing",entity_id)
            e = world.get_entity( entity_id )
            image1 = e.get_component("image1")
            image2 = e.get_component("image2")

            if not "payload" in image1:
                print("no payload in image1, skipping")
                continue
            if not "payload" in image2:
                print("no payload in image2, skipping")
                continue
            #print("merger has all data, merging!!!!!!!!!!!!")

            #rgb1 = image1["payload"]["rgb"]
            #rgb2 = image2["payload"]["rgb"]

            #list_rgb =[ image1["payload"]["rgb"], image2["payload"]["rgb"]]
            #list_depth =[ image1["payload"]["depth"], image2["payload"]["depth"]]

            #rgb,depth = compose_rgb_depth( list_rgb, list_depth )
            rgb,depth = merge_by_depth( image1["payload"]["rgb"], image1["payload"]["depth"], image2["payload"]["rgb"], image2["payload"]["depth"] )

            
            #imageio.imwrite(f"{entity_id}_iter_{i:05d}.png", rgb)
            msg = {"payload":{"rgb":rgb,"depth":depth}}
            e.update_component("image",msg)
            # простая отметка для рассылки
            e.update_component("image_done",dict())
            # убираем чтобы не повторяться
            e.remove_component("image1")
            e.remove_component("image2")



# todo voxel-volume-pass назвать
class Pass3D:
    def __init__(self,shape,n):
        self.shape = shape # [cx,cy,cz] число кубиков
        self.distribution = []
        self.n = n

    def deploy( self,workers ):
        total = self.shape[0] * self.shape[1] * self.shape[2]
        #for i in range(total):
        i = 0
        for nx in range(self.shape[0]):
            for ny in range(self.shape[1]):
                for nz in range(self.shape[2]):                    
                    n =  i % len(workers)
                    # todo добавить guid
                    object_id = f"pass3d_item_{i}"
                    pos = [nx,ny,nz]
                    print("deploy pass3d_item ",dict(pos=pos,
                                shape=self.shape,
                                n=self.n,
                                id=object_id))
                    i = i + 1
                    nodes = gen.node( "pass3d_item",
                                pos=pos,
                                shape=self.shape,
                                n=self.n,
                                object_id=object_id
                                )
                    workers[n].put( {"description":nodes,"action":"create"} )

                    # объект канала воркера, id воркера локальный там удаленный
                    d = [ workers[n], object_id ]
                    self.distribution.append( d )


class pass3d_item:
    def __init__(self,rapi,description,parent):
        #self.id = gen.id_generator()        
        #self.positions = rapi.channel(self.id + 'positions').cell()

        self.output = ppk.local.Channel()
        self.result = ppk.local.Channel() # итого
        self.input = ppk.local.Channel()
        self.n = ppk.local.Cell()

        self.cnt = 0

        def on_input(v):
            print("pass3d_item input changed: cnt=",self.cnt,"n=",self.n.value)
            if self.cnt < self.n.value:
                self.cnt = self.cnt +1
                self.output.put(v)
            elif self.cnt == self.n.value:
                self.result.put(v)

        self.input.react( on_input )

        print("pass3d_item item created")

        gen.apply_description( rapi, self, description )


class TriggerPass3D:
    def __init__(self,shape,n):
        self.shape = shape # [cx,cy,cz] число кубиков
        self.distribution = []
        self.n = n

    def deploy( self,workers ):
        total = self.shape[0] * self.shape[1] * self.shape[2]
        #for i in range(total):
        i = 0
        for nx in range(self.shape[0]):
            for ny in range(self.shape[1]):
                for nz in range(self.shape[2]):                    
                    n =  i % len(workers)
                    # todo добавить guid
                    object_id = f"pass3d_item_{i}"
                    pos = [nx,ny,nz]
                    print("deploy pass3d_item ",dict(pos=pos,
                                shape=self.shape,
                                n=self.n,
                                id=object_id))
                    i = i + 1
                    nodes = gen.node( "trigger_pass3d_item",
                                pos=pos,
                                shape=self.shape,
                                n=self.n,
                                object_id=object_id
                                )
                    workers[n].put( {"description":nodes,"action":"create"} )

                    # объект канала воркера, id воркера локальный там удаленный
                    d = [ workers[n], object_id ]
                    self.distribution.append( d )


class trigger_pass3d_item:
    def __init__(self,rapi,description,parent):
        #self.id = gen.id_generator()        
        #self.positions = rapi.channel(self.id + 'positions').cell()

        self.output = ppk.local.Channel()
        self.result = ppk.local.Channel() # итого
        self.input = ppk.local.Channel()
        self.trigger = ppk.local.Channel()
        self.n = ppk.local.Cell()

        self.cnt = 0

        self.trigger_pass = False
        self.trigger_value = None

        def on_trigger(v):
            if self.trigger_value is not None:
                self.output.put( self.trigger_value )
                self.trigger_pass = False
            else:
                self.trigger_pass = True

        def on_input(v):
            #print("pass3d_item input changed: cnt=",self.cnt,"n=",self.n.value)
            if self.cnt < self.n.value:
                self.cnt = self.cnt +1
                if self.trigger_pass:
                    self.output.put(v)
                    self.trigger_pass = False
                    self.trigger_value = None                    
                else:
                    self.trigger_value = v
            elif self.cnt == self.n.value:
                self.result.put(v)

        self.input.react( on_input )
        self.trigger.react( on_trigger )

        print("trigger_pass3d_item item created")

        gen.apply_description( rapi, self, description )



def init(*args):
    gen.register({"pass3d_item":pass3d_item})
    gen.register({"trigger_pass3d_item":trigger_pass3d_item})
    gen.register({"image_saver":image_saver})
    gen.register({"image_merger":image_merger})
    
    

################
