# Passport-OpenAM

General-purpose [OpenAM](http://forgerock.com/products/open-identity-stack/openam/) authentication strategies for [Passport](https://github.com/jaredhanson/passport).

OpenAM is an open source access management, entitlements and federation server platform.

This module lets you authenticate using OpenAM in your Node.js applications.
By plugging into Passport, OpenAM authentication can be easily and unobtrusively
integrated into any application or framework that supports
[Connect](http://www.senchalabs.org/connect/)-style middleware, including
[Express](http://expressjs.com/).

This development branch is based off of the [original module](https://github.com/alesium/passport-openam) developed by [Sebastien Perreault](https://github.com/sperreault) with [fixes](https://github.com/marksyzm/passport-openam) provided by [Mark Elphinstone-Hoadley](https://github.com/marksyzm). The goal of this fork is to provide a more generalized implementation applicable for protecting REST resources.

## Installation

    `npm install passport-openam`

## Tests

    `npm test`

## Credits

  - [Mark Elphinstone-Hoadley](https://github.com/marksyzm)
  - [Jared Hanson](https://github.com/jaredhanson)
  - [Sebastien Perreault](https://github.com/sperreault)

## License

(The MIT License)

Copyright (c) 2014 Geocent

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
