# Local development

## Set up env vars and secrets
Request `.env` secrets file from a team member

1. Add `.env` to the project root
2. Add `.env.local` file under `willy/client/`. Make sure the `REACT_APP_USER_POOL_CLIENT_ID` and `REACT_APP_USER_POOL_ID` secrets from `willy/.env` is there too.

## Run the application

0. Install dependencies if you have not yet
```
npm install
```

1. Generate backend DB schema
```
npx prisma generate
```

2. Run the server
```
npm run server
```

3. Run client
In a separate terminal pane, run the client
```
npm run client
```

## Other Docs
1. Follow this document on DB migration process, and local set up on DB https://docs.google.com/document/d/1VDwaHk957-yiXpqEfeiSBJLf8Nsyc4-SSobYlFJusCc/edit#heading=h.2pimolqyn4h2
