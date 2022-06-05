# MySQL-REST-Proxy

This is a simple node.js program used to provide RESTful interface for MySQL.

Frontend can do CRUD operations directly by sending RESTful request.

> Note: This's not safety, so do not use this method in production.

## Usage

- MySQL connection configure:
Edit `mysql-config-demo.json` file and rename to `mysql-config.json`.

- Install dependencies:
```bash
npm install
```

- Run:
```bash
npm start
```
or
```bash
sudo PORT=80 node app.js
```

- Build docker image:
```
npm run build
```

## API Doc

https://www.apifox.cn/apidoc/shared-0f9baa3a-6a1e-40b6-9ae6-082b95005065/api-21444582

The API is designed for [Baidu AMIS](https://github.com/baidu/amis), a front-end low-code framework.
