FROM node:18

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install --registry=https://registry.npm.taobao.org --disturl=https://npm.taobao.org/dist

# Bundle app source
COPY app.js .
COPY mysql-config.json .

ENV PORT=80
EXPOSE $PORT

CMD [ "node",  "app.js" ]
