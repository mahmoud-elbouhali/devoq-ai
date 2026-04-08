FROM nginx:alpine

RUN apk add --no-cache dumb-init wget

COPY ./nginx.conf /etc/nginx/nginx.conf
COPY dist /usr/share/nginx/html

RUN printf "OK" > /usr/share/nginx/html/health

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["nginx", "-g", "daemon off;"]
