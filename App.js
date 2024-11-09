import React, { useState } from 'react';
import { StyleSheet, Text, View, Button, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';

const API_KEY = 'bb8201815d6048c59a3406bd1576a296';

export default function App() {
  const [recording, setRecording] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);

  const startRecording = async () => {
    try {
      // Request microphone permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        // Prepare the audio recorder
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
        );
        setRecording(recording);
        console.log('Recording started');
      } else {
        console.log('Permission to access microphone denied');
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    try {
      console.log('Stopping recording...');
      setRecording(undefined);
      await recording.stopAndUnloadAsync();

      // Get the file URI of the recording
      const uri = recording.getURI();
      console.log('Recording stopped and stored at', uri);

      // Upload the recorded file
      await uploadRecording(uri);
    } catch (error) {
      console.error('Failed to stop recording', error);
    }
  };

  const uploadRecording = async (uri) => {
    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('file', {
        uri,
        type: 'audio/m4a', // Ensure MIME type is audio/m4a for AssemblyAI
        name: 'recording.m4a',
      });

      // Step 1: Upload the file to AssemblyAI
      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        body: formData,
        headers: {
          authorization: API_KEY,
        },
      });

      const uploadData = await uploadResponse.json();
      if (!uploadData.upload_url) {
        throw new Error('Upload failed');
      }
      const audioUrl = uploadData.upload_url;

      // Step 2: Request transcription
      const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          authorization: API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio_url: audioUrl }),
      });

      const transcriptData = await transcriptResponse.json();
      const transcriptId = transcriptData.id;

      // Step 3: Poll the API for transcription results
      let status = 'processing';
      let transcriptResult = '';

      while (status === 'processing') {
        const result = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          method: 'GET',
          headers: { authorization: API_KEY },
        });

        const resultData = await result.json();
        status = resultData.status;

        if (status === 'completed') {
          transcriptResult = resultData.text;
          setTranscript(transcriptResult);
        } else if (status === 'failed') {
          throw new Error('Transcription failed');
        }

        // Wait for a few seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

    } catch (error) {
      console.error(error);
      setTranscript('Error transcribing audio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Simple Speech to Text</Text>
      {recording ? (
        <Button title="Stop Recording" onPress={stopRecording} />
      ) : (
        <Button title="Start Recording" onPress={startRecording} />
      )}
      {loading ? <ActivityIndicator size="large" color="#0000ff" /> : <Text style={styles.transcript}>{transcript}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  transcript: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
});
