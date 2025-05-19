# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Sample Curl to create Panic
```
curl -X POST \
  https://s1rrkf2n0f.execute-api.eu-west-1.amazonaws.com/dev/panic \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "test-user-123",
    "appIdSource": "poc-test-app",
    "location": {
      "latitude": 34.0522,
      "longitude": -118.2437
    },
    "message": "This is a PoC test panic event."
  }'
```

## Sample Curl to get Panic
```
curl -X GET \
  https://s1rrkf2n0f.execute-api.eu-west-1.amazonaws.com/dev/panic/ead80580-eee8-4900-add1-8b5cd67dabb6 \
  -H 'x-api-key: K4DVdUHoBv1SkhM1LaBgY4xFM8hsUWST8dgYl2NG' \
  -i
```