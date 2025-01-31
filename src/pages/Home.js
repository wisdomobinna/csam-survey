// src/pages/Home.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-100 to-purple-100">
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-4xl font-bold text-center">
              Welcome to Art Survey Research
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="text-center space-y-4">
              <p className="text-lg text-gray-600">
                Participate in our research study exploring the relationship between art and human perception.
              </p>
              <p className="text-gray-600">
                You'll be shown a series of artworks and asked to complete short surveys about each piece.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">What to expect:</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-600">
                <li>View 12 carefully selected artworks</li>
                <li>Complete a short survey for each artwork</li>
                <li>Estimated time: 20-30 minutes</li>
                <li>Your responses will be kept confidential</li>
              </ul>
            </div>

            <div className="flex justify-center space-x-4">
              <Button
                onClick={() => navigate('/login')}
                className="px-8"
              >
                Start Survey
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;