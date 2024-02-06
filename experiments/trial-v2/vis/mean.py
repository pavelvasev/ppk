#!/bin/env python3

import pandas as pd

df = pd.read_csv("data.csv")
print(df)

#df2 = df["SECONDS"].mean()

#df = df[ df["DN"] == 100000 ].drop( ["DN"],axis=1 )
df2 = df.groupby( ["CMD","DN","P"] ).min()
#df2 = df.groupby( ["CMD","P"] ).mean() #.groupby( ["P"] )
print(df2)
df2.to_csv('mean.csv')

exit()

