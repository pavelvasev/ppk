Генератор графа питон-объектов.

Объекты на языке Питон описываются так:

```
class mytype:
    def __init__(self,rapi,description,parent):
        self.rapi = rapi
        self.parent = parent

        gen.apply_description( rapi, self, description )
```

здесь rapi - интерфейс системы каналов PPK, description - словарь с параметрами и прочим описанием объекта, parent - родительский объект.
