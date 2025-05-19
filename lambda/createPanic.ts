import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from 'crypto';

const sqsClient = new SQSClient({});
const dynamoDbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(dynamoDbClient);

const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const panicId = randomUUID();
  console.log(`CreatePanicLambda invoked. Generated panicId: ${panicId}. Event:`, JSON.stringify(event, null, 2));

  if (!DYNAMODB_TABLE_NAME || !SQS_QUEUE_URL) {
    console.error(`[panicId: ${panicId}] Missing environment variables: DYNAMODB_TABLE_NAME or SQS_QUEUE_URL.`);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error: Missing configuration.', panicId }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  if (!event.body) {
    console.warn(`[panicId: ${panicId}] Request body is missing.`);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Request body is required.', panicId }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  let requestBody;
  try {
    requestBody = JSON.parse(event.body);
  } catch (error) {
    console.error(`[panicId: ${panicId}] Failed to parse request body:`, error);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid JSON format in request body.', panicId }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const { userId, appIdSource } = requestBody;
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    console.warn(`[panicId: ${panicId}] Validation failed: userId is missing or invalid.`);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'userId is required and must be a non-empty string.', panicId }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
  if (!appIdSource || typeof appIdSource !== 'string' || appIdSource.trim() === '') {
    console.warn(`[panicId: ${panicId}] Validation failed: appIdSource is missing or invalid.`);
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'appIdSource is required and must be a non-empty string.', panicId }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  const receivedAt = new Date().toISOString();
  const initialPanicData = {
    panicId: panicId,
    status: 'RECEIVED',
    receivedAt: receivedAt,
    userId: userId.trim(),
    appIdSource: appIdSource.trim(),
    ipAddress: event.requestContext?.identity?.sourceIp || 'unknown',
    initialPayload: requestBody
  };

  // 1. Store initial record in DynamoDB
  try {
    const putCommand = new PutCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Item: initialPanicData,
    });
    await ddbDocClient.send(putCommand);
    console.log(`[panicId: ${panicId}] Successfully stored initial panic data to DynamoDB.`);
  } catch (dbError) {
    console.error(`[panicId: ${panicId}] Failed to store data in DynamoDB:`, dbError);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to save panic event data.', panicId }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  // 2. Send message to SQS for asynchronous processing
  try {
    const sqsMessage = {
      panicId: panicId,
      userId: initialPanicData.userId,
      appIdSource: initialPanicData.appIdSource,
      ipAddress: initialPanicData.ipAddress
    };
    const sendMessageCommand = new SendMessageCommand({
      QueueUrl: SQS_QUEUE_URL,
      MessageBody: JSON.stringify(sqsMessage),
    });
    await sqsClient.send(sendMessageCommand);
    console.log(`[panicId: ${panicId}] Successfully sent message to SQS.`);
  } catch (sqsError) {
    console.error(`[panicId: ${panicId}] Failed to send message to SQS after saving to DynamoDB. This panic event may not be processed. SQS Error:`, sqsError);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        message: 'Panic event created but failed to queue for processing. Please contact support.', 
        panicId: panicId 
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  console.log(`[panicId: ${panicId}] CreatePanicLambda completed successfully.`);
  return {
    statusCode: 201,
    body: JSON.stringify({
      message: 'Panic event received successfully.',
      panicId: panicId,
    }),
    headers: {
      'Content-Type': 'application/json',
    }
  };
};
