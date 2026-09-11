# First deployment foundation. API resources follow after packaging and secret setup.
resource "aws_dynamodb_table" "tailgate" {
  name                        = local.name
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "PK"
  range_key                   = "SK"
  deletion_protection_enabled = true

  attribute {
    name = "PK"
    type = "S"
  }
  attribute {
    name = "SK"
    type = "S"
  }
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
  point_in_time_recovery {
    enabled = true
  }
  server_side_encryption {
    enabled = true
  }
  lifecycle {
    prevent_destroy = true
  }
}

output "table_name" {
  value = aws_dynamodb_table.tailgate.name
}
output "table_arn" {
  value = aws_dynamodb_table.tailgate.arn
}
output "deployment_target" {
  value = { account_id = local.account_id, region = local.region }
}
