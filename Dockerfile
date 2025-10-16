FROM nginx:alpine

COPY web/ /usr/share/nginx/html/
COPY img/ /usr/share/nginx/html/img/

EXPOSE 80

