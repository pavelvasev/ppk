#!/usr/bin/env node

import * as PPK from "../../../client-api/client-api.js"

PPK.connect("test").then(rapi => {
  console.log("connected")
  rapi.exit()
})