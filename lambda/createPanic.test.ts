process.env.DYNAMODB_TABLE_NAME = 'TestPanicEventsTable';
process.env.SQS_QUEUE_URL = 'test-queue-url';

import { handler } from './createPanic';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest'; 
import { Context, APIGatewayProxyEvent } from 'aws-lambda';

interface CreatePanicPayload {
  userId: string;
  appIdSource: string;
  ipAddress?: string;
  timestamp?: string;
  [key: string]: any;
}

// Create mock clients
const ddbMock = mockClient(DynamoDBDocumentClient);
const sqsMock = mockClient(SQSClient);

describe('CreatePanicLambda Handler', () => {
  beforeEach(() => {
    ddbMock.reset();
    sqsMock.reset();
  });

  it('should process a valid panic event successfully', async () => {
    const mockPayload: CreatePanicPayload = {
      userId: 'user-123',
      appIdSource: 'test-app',
      ipAddress: '192.168.1.1',
      timestamp: new Date().toISOString(),
      customField: 'customValue'
    };

    const mockEvent: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify(mockPayload),
      requestContext: {
        identity: {
          sourceIp: '123.123.123.123',
        },
      } as any,
    };

    ddbMock.on(PutCommand).resolves({});
    sqsMock.on(SendMessageCommand).resolves({ MessageId: 'sqs-message-id' });

    const result = await handler(mockEvent as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(201);
    const responseBody = JSON.parse(result.body);
    expect(responseBody).toHaveProperty('panicId');
    expect(typeof responseBody.panicId).toBe('string');
    expect(responseBody.message).toBe('Panic event received successfully.');

    // Verify DynamoDB PutCommand was called correctly
    expect(ddbMock).toHaveReceivedCommandTimes(PutCommand, 1);
    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Item: expect.objectContaining({
        panicId: responseBody.panicId,
        userId: mockPayload.userId,
        appIdSource: mockPayload.appIdSource,
        ipAddress: '123.123.123.123',
        status: 'RECEIVED',
        initialPayload: mockPayload,
        receivedAt: expect.any(String),
      }),
    });

    // Verify SQS SendMessageCommand was called correctly
    expect(sqsMock).toHaveReceivedCommandTimes(SendMessageCommand, 1);
    const sqsCall = sqsMock.commandCalls(SendMessageCommand)[0];
    const sqsMessageBody = JSON.parse(sqsCall.args[0].input.MessageBody!);
    
    expect(sqsCall.args[0].input.QueueUrl).toBe(process.env.SQS_QUEUE_URL);
    expect(sqsMessageBody).toEqual(expect.objectContaining({
      panicId: responseBody.panicId,
      userId: mockPayload.userId,
      appIdSource: mockPayload.appIdSource,
      ipAddress: '123.123.123.123',
    }));
  });

  // TODO: Add more test cases:
  // - Invalid payload (e.g., missing userId)
  // - DynamoDB PutCommand failure
  // - SQS SendMessageCommand failure
  // - Non-JSON body
  // - Empty body
});
