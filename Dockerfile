FROM nginx:1.27-alpine

COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY . /usr/share/nginx/html
RUN chmod -R a+rX /usr/share/nginx/html

ENV PORT=8080
EXPOSE 8080
