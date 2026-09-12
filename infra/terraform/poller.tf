variable "cfbd_api_key" {
  type      = string
  sensitive = true
  validation {
    condition     = length(var.cfbd_api_key) > 10
    error_message = "Configure a personal CFBD API key."
  }
}
variable "poller_enabled" {
  type    = bool
  default = true
}
resource "aws_cloudwatch_log_group" "poller" {
  name              = "/aws/lambda/tailgate-poller"
  retention_in_days = 14
}
resource "aws_iam_role" "poller" {
  name               = "tailgate-poller"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}
resource "aws_iam_role_policy" "poller" {
  name = "tailgate-poller"
  role = aws_iam_role.poller.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:UpdateItem", "dynamodb:PutItem"], Resource = aws_dynamodb_table.tailgate.arn, Condition = { "ForAllValues:StringEquals" = { "dynamodb:LeadingKeys" = ["CONTEST#sept12-2026-revised"] } } },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.poller.arn}:*" }
  ] })
}
resource "aws_lambda_function" "poller" {
  function_name                  = "tailgate-poller"
  role                           = aws_iam_role.poller.arn
  runtime                        = "nodejs22.x"
  architectures                  = ["arm64"]
  handler                        = "dist/apps/poller/src/index.handler"
  filename                       = "${path.module}/../../artifacts/api.zip"
  source_code_hash               = filebase64sha256("${path.module}/../../artifacts/api.zip")
  memory_size                    = 256
  timeout                        = 45
  reserved_concurrent_executions = 1
  environment {
    variables = {
      TAILGATE_TABLE      = aws_dynamodb_table.tailgate.name
      TAILGATE_CONTEST_ID = "sept12-2026-revised"
      CFBD_API_KEY        = var.cfbd_api_key
      CFBD_MAPPINGS       = file("${path.module}/cfbd-mappings.json")
      POLL_START          = "2026-09-12T16:00:00Z"
      POLL_END            = "2026-09-13T08:00:00Z"
    }
  }
  depends_on = [aws_iam_role_policy.poller, aws_cloudwatch_log_group.poller]
}
resource "aws_lambda_function_event_invoke_config" "poller" {
  function_name                = aws_lambda_function.poller.function_name
  maximum_event_age_in_seconds = 60
  maximum_retry_attempts       = 0
}
resource "aws_cloudwatch_event_rule" "poller" {
  for_each            = { saturday = "cron(* 16-23 ? * SAT *)", sunday = "cron(* 0-7 ? * SUN *)" }
  name                = "tailgate-poller-${each.key}"
  schedule_expression = each.value
  state               = var.poller_enabled ? "ENABLED" : "DISABLED"
}
resource "aws_cloudwatch_event_target" "poller" {
  for_each = aws_cloudwatch_event_rule.poller
  rule     = each.value.name
  arn      = aws_lambda_function.poller.arn
  retry_policy {
    maximum_event_age_in_seconds = 60
    maximum_retry_attempts       = 0
  }
}
resource "aws_lambda_permission" "poller" {
  for_each      = aws_cloudwatch_event_rule.poller
  statement_id  = "AllowSchedule-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.poller.function_name
  principal     = "events.amazonaws.com"
  source_arn    = each.value.arn
}
resource "aws_cloudwatch_metric_alarm" "poller_errors" {
  alarm_name          = "tailgate-poller-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = aws_lambda_function.poller.function_name }
}
