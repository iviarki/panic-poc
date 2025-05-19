# Welcome to the PanicPOC

## Overview

Building a panic response API system that will enable users or integrators to trigger emergency alerts and query panic event statuses in real time. The system will prioritize high availability, fault tolerance, and observability, ensuring reliable performance even under high request loads.

## Core Features

- POST /panic endpoint to create a new panic event and return a unique ID immediately.
- GET /panic/:id endpoint to retrieve panic event details, even if processing is still underway.
- Asynchronous processing pipeline to enrich and persist full panic event data.

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
