import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const dynamoDbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(dynamoDbClient);

const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const panicId = event.pathParameters?.id;
  console.log(`GetPanicLambda invoked. Path parameters: ${JSON.stringify(event.pathParameters)}. Requested panicId: ${panicId}`);

  if (!DYNAMODB_TABLE_NAME) {
    console.error(`[panicId: ${panicId || 'unknown'}] Missing environment variable: DYNAMODB_TABLE_NAME.`);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error: Missing configuration.' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  if (!panicId) {
    console.warn('Path parameter "id" (panicId) is missing.');
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Panic ID is missing in the request path.' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  try {
    const getParams = {
      TableName: DYNAMODB_TABLE_NAME,
      Key: { panicId: panicId },
    };

    console.log(`[panicId: ${panicId}] Attempting to get item from DynamoDB with params:`, JSON.stringify(getParams));
    const { Item } = await ddbDocClient.send(new GetCommand(getParams));

    if (!Item) {
      console.warn(`[panicId: ${panicId}] Panic event not found in DynamoDB.`);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Panic event not found.' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    console.log(`[panicId: ${panicId}] Successfully retrieved panic event:`, JSON.stringify(Item));
    const responsePayload = {
      panicId: Item.panicId,
      status: Item.status,
      receivedAt: Item.receivedAt,
      processedAt: Item.processedAt,
      userId: Item.userId,
      appIdSource: Item.appIdSource,
      processingMessage: Item.processingMessage
    };
    
    return {
      statusCode: 200,
      body: JSON.stringify(responsePayload),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    console.error(`[panicId: ${panicId}] Error retrieving panic event from DynamoDB:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to retrieve panic event data.' }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
};
