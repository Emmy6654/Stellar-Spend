import json
import boto3
import os
from datetime import datetime, timedelta

ce_client = boto3.client('ce')
ec2_client = boto3.client('ec2')
rds_client = boto3.client('rds')
sns_client = boto3.client('sns')

SNS_TOPIC_ARN = os.environ['SNS_TOPIC_ARN']
ENVIRONMENT = os.environ['ENVIRONMENT']

def handler(event, context):
    """
    Lambda function to analyze costs and provide optimization recommendations
    """
    recommendations = []
    
    # Analyze EC2 instances
    recommendations.extend(analyze_ec2_instances())
    
    # Analyze RDS instances
    recommendations.extend(analyze_rds_instances())
    
    # Analyze cost trends
    recommendations.extend(analyze_cost_trends())
    
    # Send recommendations via SNS
    if recommendations:
        send_recommendations(recommendations)
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'recommendations': len(recommendations),
            'timestamp': datetime.now().isoformat()
        })
    }

def analyze_ec2_instances():
    """Analyze EC2 instances for optimization opportunities"""
    recommendations = []
    
    try:
        response = ec2_client.describe_instances(
            Filters=[
                {'Name': 'instance-state-name', 'Values': ['running']},
                {'Name': 'tag:Project', 'Values': ['stellar-spend']}
            ]
        )
        
        for reservation in response['Reservations']:
            for instance in reservation['Instances']:
                instance_id = instance['InstanceId']
                instance_type = instance['InstanceType']
                
                # Check for low utilization
                if is_low_utilization(instance_id):
                    recommendations.append({
                        'type': 'EC2_DOWNSIZE',
                        'resource': instance_id,
                        'current_type': instance_type,
                        'recommendation': f'Consider downsizing {instance_id} from {instance_type}',
                        'potential_savings': estimate_ec2_savings(instance_type)
                    })
                
                # Check for unused instances
                if is_unused_instance(instance_id):
                    recommendations.append({
                        'type': 'EC2_TERMINATE',
                        'resource': instance_id,
                        'recommendation': f'Instance {instance_id} appears unused. Consider terminating.',
                        'potential_savings': estimate_ec2_cost(instance_type)
                    })
    
    except Exception as e:
        print(f"Error analyzing EC2: {str(e)}")
    
    return recommendations

def analyze_rds_instances():
    """Analyze RDS instances for optimization opportunities"""
    recommendations = []
    
    try:
        response = rds_client.describe_db_instances(
            Filters=[
                {'Name': 'engine', 'Values': ['postgres']}
            ]
        )
        
        for db in response['DBInstances']:
            db_id = db['DBInstanceIdentifier']
            db_class = db['DBInstanceClass']
            
            # Check for low connections
            if has_low_connections(db_id):
                recommendations.append({
                    'type': 'RDS_DOWNSIZE',
                    'resource': db_id,
                    'current_class': db_class,
                    'recommendation': f'Consider downsizing {db_id} to smaller instance class',
                    'potential_savings': estimate_rds_savings(db_class)
                })
            
            # Check for unused storage
            if has_unused_storage(db_id):
                recommendations.append({
                    'type': 'RDS_STORAGE',
                    'resource': db_id,
                    'recommendation': f'Database {db_id} has unused storage. Consider reducing allocation.',
                    'potential_savings': estimate_storage_savings(db_id)
                })
    
    except Exception as e:
        print(f"Error analyzing RDS: {str(e)}")
    
    return recommendations

def analyze_cost_trends():
    """Analyze cost trends for anomalies"""
    recommendations = []
    
    try:
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=30)
        
        response = ce_client.get_cost_and_usage(
            TimePeriod={
                'Start': start_date.isoformat(),
                'End': end_date.isoformat()
            },
            Granularity='DAILY',
            Metrics=['UnblendedCost'],
            Filter={
                'Tags': {
                    'Key': 'Project',
                    'Values': ['stellar-spend']
                }
            }
        )
        
        costs = []
        for result in response['ResultsByTime']:
            cost = float(result['Total']['UnblendedCost']['Amount'])
            costs.append(cost)
        
        if len(costs) > 7:
            avg_cost = sum(costs[:-7]) / len(costs[:-7])
            recent_avg = sum(costs[-7:]) / 7
            
            if recent_avg > avg_cost * 1.2:
                increase_pct = ((recent_avg - avg_cost) / avg_cost) * 100
                recommendations.append({
                    'type': 'COST_SPIKE',
                    'recommendation': f'Cost increased by {increase_pct:.1f}% in the last 7 days. Investigate.',
                    'current_daily_avg': f'${recent_avg:.2f}',
                    'previous_daily_avg': f'${avg_cost:.2f}'
                })
    
    except Exception as e:
        print(f"Error analyzing cost trends: {str(e)}")
    
    return recommendations

def is_low_utilization(instance_id):
    """Check if EC2 instance has low CPU utilization"""
    # Simplified check - in production, query CloudWatch metrics
    return False

def is_unused_instance(instance_id):
    """Check if EC2 instance is unused"""
    # Simplified check - in production, query CloudWatch metrics
    return False

def has_low_connections(db_id):
    """Check if RDS has low connections"""
    # Simplified check - in production, query CloudWatch metrics
    return False

def has_unused_storage(db_id):
    """Check if RDS has unused storage"""
    # Simplified check - in production, query CloudWatch metrics
    return False

def estimate_ec2_savings(instance_type):
    """Estimate monthly savings for EC2 downsize"""
    # Simplified estimation
    return "$50-100/month"

def estimate_ec2_cost(instance_type):
    """Estimate monthly cost for EC2 instance"""
    # Simplified estimation
    return "$100-200/month"

def estimate_rds_savings(db_class):
    """Estimate monthly savings for RDS downsize"""
    # Simplified estimation
    return "$100-200/month"

def estimate_storage_savings(db_id):
    """Estimate monthly savings for storage reduction"""
    # Simplified estimation
    return "$20-50/month"

def send_recommendations(recommendations):
    """Send recommendations via SNS"""
    message = "Cost Optimization Recommendations\n"
    message += "=" * 50 + "\n\n"
    
    for i, rec in enumerate(recommendations, 1):
        message += f"{i}. {rec['type']}\n"
        message += f"   Resource: {rec.get('resource', 'N/A')}\n"
        message += f"   Recommendation: {rec['recommendation']}\n"
        if 'potential_savings' in rec:
            message += f"   Potential Savings: {rec['potential_savings']}\n"
        message += "\n"
    
    try:
        sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=f'[{ENVIRONMENT}] Cost Optimization Recommendations',
            Message=message
        )
    except Exception as e:
        print(f"Error sending SNS notification: {str(e)}")
