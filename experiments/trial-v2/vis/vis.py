#!/bin/env python3

import pandas as pd
import matplotlib.pyplot as plt

df1 = pd.read_csv("mean.csv")

def make(df,interest):
  adf = df[ df["DN"] == interest ].drop( ["DN"],axis=1 )
  adf = adf.pivot(index='P', columns='CMD', values='SECONDS')
  print("")
  print( "### Размер сетки " + str(interest))

  block_size = [str(int(interest/x)) for x in adf.index]
  adf.insert(0,"b",block_size)
  print(adf.to_markdown())
  adf.plot(kind='bar',title=interest)#,colormap="Greens");
  #plt.show()
  fname = str(interest)+'.png'
  plt.savefig(fname)
  print("")
  print(f"![]({fname})")
  
print("""
## Результаты

* P - количество исполнителей.
* b - размер одного блока (кол-во ячеек).
* Значения в таблицах - время в секундах.

Список всех запусков [data.csv](data.csv) и итоговые времена [mean.csv](mean.csv)
""")
  
make( df1, 100000 )
make( df1, 1000000 )
make( df1, 10000000 )

exit()

df = df.groupby( ["CMD","DN","P"] )

exit()

for index, row in df.iterrows():
    print(row['P'], row['CMD'])
    
exit()

df = df[ df["DN"] == 100000 ].drop( ["DN"],axis=1 )
df = df.groupby( ["P"] )

print(df.indices)
print(df.get_group(2))

exit()

#df = df.T
#df2 = df["SECONDS"].mean()



print(df)

df = df.groupby( ["CMD","DN","P"] )

#df2 = df.groupby( ["CMD","DN","P"] ).mean()
#df2 = df.groupby( ["CMD","P"] ).mean() #.groupby( ["P"] )
#print(df2)
#df2.to_csv('vis.csv')

#exit()

import matplotlib.pyplot as plt

df.plot(kind='bar')#,colormap="Greens");
plt.show()