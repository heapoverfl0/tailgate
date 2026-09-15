variable "commissioner_password" {
  type      = string
  sensitive = true
  validation {
    condition     = length(var.commissioner_password) >= 24
    error_message = "Use a generated commissioner password of at least 24 characters."
  }
}
variable "session_signing_secret" {
  type      = string
  sensitive = true
  validation {
    condition     = length(var.session_signing_secret) >= 32
    error_message = "Use a separate signing secret of at least 32 characters."
  }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/tailgate-api"
  retention_in_days = 14
}
resource "aws_cloudwatch_log_group" "access" {
  name              = "/tailgate/api-access"
  retention_in_days = 14
}
resource "aws_iam_role" "api" {
  name = "tailgate-api"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}
resource "aws_iam_role_policy" "api" {
  name = "tailgate-api"
  role = aws_iam_role.api.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:DeleteItem", "dynamodb:ConditionCheckItem"]
        Resource = aws_dynamodb_table.tailgate.arn
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.api.arn}:*"
      }
    ]
  })
}
resource "aws_apigatewayv2_api" "api" {
  name                         = "tailgate-api"
  protocol_type                = "HTTP"
  disable_execute_api_endpoint = var.maintenance_mode
}
resource "aws_lambda_function" "api" {
  reserved_concurrent_executions = var.maintenance_mode ? 0 : -1
  function_name                  = "tailgate-api"
  role                           = aws_iam_role.api.arn
  runtime                        = "nodejs22.x"
  architectures                  = ["arm64"]
  handler                        = "dist/apps/api/src/index.handler"
  filename                       = "${path.module}/../../artifacts/api.zip"
  source_code_hash               = filebase64sha256("${path.module}/../../artifacts/api.zip")
  memory_size                    = 256
  timeout                        = 15
  environment {
    variables = {
      TAILGATE_TABLE         = aws_dynamodb_table.tailgate.name
      APP_ORIGIN             = "https://${aws_cloudfront_distribution.web.domain_name}"
      COMMISSIONER_PASSWORD  = var.commissioner_password
      SESSION_SIGNING_SECRET = var.session_signing_secret
    }
  }
  depends_on = [aws_iam_role_policy.api, aws_cloudwatch_log_group.api]
}
resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 15000
}
resource "aws_apigatewayv2_route" "api" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /api/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}
resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.access.arn
    format = jsonencode({
      requestId = "$context.requestId", routeKey = "$context.routeKey",
      status    = "$context.status", responseLength = "$context.responseLength"
    })
  }
}
resource "aws_lambda_permission" "api" {
  statement_id  = "AllowTailgateApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*/api/*"
}
output "api_url" {
  value = aws_apigatewayv2_api.api.api_endpoint
}
