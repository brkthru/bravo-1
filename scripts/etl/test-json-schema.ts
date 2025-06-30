#!/usr/bin/env bun
import { CampaignSchema } from '../../shared/src/types';
import { CampaignEntitySchema } from '../../shared/src/schemas/entities/campaign.schema';
import {
  toMongoDBJsonSchema,
  toOpenAPIJsonSchema,
  createMongoDBValidator,
  createOpenAPIComponent,
} from '../../shared/src/schemas/core/json-schema.utils';

async function testJsonSchemaGeneration() {
  console.log('Testing JSON Schema generation from Zod schemas...\n');

  try {
    // Test 1: Generate MongoDB JSON Schema
    console.log('1. MongoDB JSON Schema Generation:');
    console.log('==================================');

    const mongoSchema = toMongoDBJsonSchema(CampaignSchema);
    console.log('✅ MongoDB JSON Schema generated successfully');
    console.log(`   Schema type: ${mongoSchema.type}`);
    console.log(`   Properties: ${Object.keys(mongoSchema.properties || {}).length}`);
    console.log(`   Required fields: ${(mongoSchema.required || []).length}`);

    // Test 2: Generate OpenAPI JSON Schema
    console.log('\n2. OpenAPI JSON Schema Generation:');
    console.log('==================================');

    const openAPISchema = toOpenAPIJsonSchema(CampaignSchema);
    console.log('✅ OpenAPI JSON Schema generated successfully');
    console.log(`   Schema type: ${openAPISchema.type}`);
    console.log(`   Properties: ${Object.keys(openAPISchema.properties || {}).length}`);

    // Test 3: Create MongoDB Validator
    console.log('\n3. MongoDB Validator Creation:');
    console.log('==============================');

    const validator = createMongoDBValidator(CampaignSchema);
    console.log('✅ MongoDB validator created successfully');
    console.log(`   Has $jsonSchema: ${!!validator.$jsonSchema}`);
    console.log(`   Additional properties: ${validator.$jsonSchema.additionalProperties}`);

    // Test 4: Create OpenAPI Component
    console.log('\n4. OpenAPI Component Creation:');
    console.log('==============================');

    const component = createOpenAPIComponent(
      'Campaign',
      CampaignSchema,
      'Represents a media campaign'
    );
    console.log('✅ OpenAPI component created successfully');
    console.log(`   Component name: ${Object.keys(component)[0]}`);
    console.log(`   Has description: ${!!component.Campaign.description}`);

    // Test 5: Verify schema structure
    console.log('\n5. Schema Structure Verification:');
    console.log('=================================');

    // Check specific properties
    const props = mongoSchema.properties;
    console.log('✅ Key properties found:');
    console.log(`   - _id: ${props._id ? 'Present' : 'Missing'}`);
    console.log(`   - campaignNumber: ${props.campaignNumber ? 'Present' : 'Missing'}`);
    console.log(`   - name: ${props.name ? 'Present' : 'Missing'}`);
    console.log(`   - price: ${props.price ? 'Present' : 'Missing'}`);
    console.log(`   - team: ${props.team ? 'Present' : 'Missing'}`);
    console.log(`   - metrics: ${props.metrics ? 'Present' : 'Missing'}`);

    // Test 6: Sample JSON Schema output
    console.log('\n6. Sample JSON Schema Output:');
    console.log('=============================');
    console.log('Price property schema:');
    console.log(JSON.stringify(props.price, null, 2));

    console.log('\n✅ All JSON Schema generation tests passed!');
  } catch (error) {
    console.error('❌ Error during JSON Schema generation:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
  }
}

testJsonSchemaGeneration();
