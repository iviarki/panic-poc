import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. DynamoDB Table
    const panicEventsTable = new dynamodb.Table(this, 'PanicEventsTable', {
      partitionKey: { name: 'panicId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: 'PanicEventsTable-PoC',
    });

    // 2. SQS Queue
    const panicProcessingQueue = new sqs.Queue(this, 'PanicProcessingQueue', {
      visibilityTimeout: cdk.Duration.seconds(300),
      queueName: 'PanicProcessingQueue-PoC',
    });

    // 3. CreatePanicLambda Function
    const createPanicLambda = new NodejsFunction(this, 'CreatePanicLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/createPanic.ts'),
      handler: 'handler',
      environment: {
        DYNAMODB_TABLE_NAME: panicEventsTable.tableName,
        SQS_QUEUE_URL: panicProcessingQueue.queueUrl,
      },
      bundling: {
        externalModules: ['aws-sdk'],
      },
    });

    panicEventsTable.grantWriteData(createPanicLambda);
    panicProcessingQueue.grantSendMessages(createPanicLambda);

    // 4. ProcessPanicLambda Function
    const processPanicLambda = new NodejsFunction(this, 'ProcessPanicLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/processPanic.ts'),
      handler: 'handler',
      environment: {
        DYNAMODB_TABLE_NAME: panicEventsTable.tableName,
      },
      bundling: {
        externalModules: ['aws-sdk'],
      },
    });
    
    panicEventsTable.grantReadWriteData(processPanicLambda);
    processPanicLambda.addEventSource(new cdk.aws_lambda_event_sources.SqsEventSource(panicProcessingQueue));


    // 5. API Gateway (for POST /panic)
    const api = new apigw.RestApi(this, 'PanicApi', {
      restApiName: 'PanicService-PoC',
      description: 'API for Panic Service PoC.',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
      }
    });

    const panicResource = api.root.addResource('panic');
    const createPanicIntegration = new apigw.LambdaIntegration(createPanicLambda);
    panicResource.addMethod('POST', createPanicIntegration, { apiKeyRequired: true });

    // 6. GetPanicLambda Function
    const getPanicLambda = new NodejsFunction(this, 'GetPanicLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/getPanic.ts'),
      handler: 'handler',
      environment: {
        DYNAMODB_TABLE_NAME: panicEventsTable.tableName,
      },
      bundling: {
        externalModules: ['aws-sdk'],
      },
    });

    panicEventsTable.grantReadData(getPanicLambda);

    const singlePanicResource = panicResource.addResource('{id}');
    const getPanicIntegration = new apigw.LambdaIntegration(getPanicLambda);
    singlePanicResource.addMethod('GET', getPanicIntegration, { apiKeyRequired: true }); // Require API Key

    // 7. API Key and Usage Plan
    const apiKey = new apigw.ApiKey(this, 'PanicServiceApiKey', {
      apiKeyName: 'PanicServiceKey-PoC',
      description: 'API Key for Panic Service PoC',
      enabled: true,
    });

    const usagePlan = new apigw.UsagePlan(this, 'PanicServiceUsagePlan', {
      name: 'PanicServiceUsagePlan-PoC',
      description: 'Usage plan for Panic Service PoC',
      apiStages: [
        {
          stage: api.deploymentStage,
          api: api,
        },
      ],
      // Implement Throttling and Quota limits.
    });

    usagePlan.addApiKey(apiKey);

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'ID of the API Key created for Panic Service',
    });
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: api.url,
      description: 'The URL of the API Gateway endpoint',
    });
    new cdk.CfnOutput(this, 'PanicEventsTableNameOutput', {
      value: panicEventsTable.tableName,
      description: 'Name of the PanicEventsTable',
    });
    new cdk.CfnOutput(this, 'PanicProcessingQueueUrlOutput', {
      value: panicProcessingQueue.queueUrl,
      description: 'URL of the PanicProcessingQueue',
    });
  }
}
