#!/bin/env python3.9

import os

def public_dir():
    return os.path.abspath( os.path.join( os.path.dirname(__file__), "public" ) )
