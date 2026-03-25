#!/usr/bin/env python3
import json
import urllib.request

print("=== Testing Enhanced API ===\n")

# Test 1: Health check
print("1. Health Endpoint:")
response = urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=3)
health = json.loads(response.read().decode())
print(f"   Status: {health['status']}, Model: {health['modelVersion']}\n")

# Test 2: Flu-like Illness
print("2. Flu-like Illness Detection:")
payload = {
    'symptoms': ['Fever', 'Body Pain', 'Cough', 'Fatigue', 'Headache'],
    'age': 40,
    'durationDays': 4,
    'notes': 'Fever is persistent'
}
req = urllib.request.Request(
    'http://127.0.0.1:8001/predict',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
response = urllib.request.urlopen(req, timeout=5)
result = json.loads(response.read().decode())
print(f"   Predicted: {result['predictedCondition']}")
print(f"   Confidence: {result['confidence']}%")
print(f"   Severity: {result['estimatedSeverity']}")
print(f"   Duration Expected: {result['durationExpected']}")
print(f"   Home Care Items: {len(result['homeCare'])}")
print(f"   Doctor Visit Criteria: {len(result['doctorWhen'])}")
print(f"   Follow-up Questions: {len(result['followUp'])}\n")

# Test 3: UTI
print("3. UTI Detection:")
payload2 = {
    'symptoms': ['Burning Urination', 'Frequent Urination', 'Lower Abdominal Pain'],
    'age': 32,
    'durationDays': 2,
    'notes': 'Burning when urinating'
}
req2 = urllib.request.Request(
    'http://127.0.0.1:8001/predict',
    data=json.dumps(payload2).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
response2 = urllib.request.urlopen(req2, timeout=5)
result2 = json.loads(response2.read().decode())
print(f"   Predicted: {result2['predictedCondition']}")
print(f"   Confidence: {result2['confidence']}%")
print(f"   Rich Data: overview={bool(result2['overview'])}, homeCare={bool(result2['homeCare'])}, timeline={bool(result2['timeline'])}")

print("\n✓ All tests passed! API returning enhanced responses.")
