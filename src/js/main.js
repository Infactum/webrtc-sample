/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

document.addEventListener('DOMContentLoaded', init);

async function init() {

  const selectSourceDiv = document.querySelector('div#selectSource');
  const audioSelect = document.querySelector('select#audioSrc');
  const videoSelect = document.querySelector('select#videoSrc');

  const getMediaButton = document.querySelector('button#getMedia');
  const createPeerConnectionButton = document.querySelector('button#createPeerConnection');
  const createOfferButton = document.querySelector('button#createOffer');
  const acceptOfferButton = document.querySelector('button#acceptOffer');
  const setAnswerButton = document.querySelector('button#setAnswer');
  const setIceButton = document.querySelector('button#setIce');

  const localVideo = document.querySelector('div#local video');
  const remoteVideo = document.querySelector('div#remote video');
  const sdpTextarea = document.querySelector('div#sdp textarea');
  const iceTextarea = document.querySelector('div#ice textarea');

  const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
  };

  const remoteStream = new MediaStream();

  let localStream;
  let peerConnection;
  let isCaller;

  audioSelect.onchange = videoSelect.onchange = getMedia;

  getMediaButton.onclick = getMedia;
  createPeerConnectionButton.onclick = createPeerConnection;
  createOfferButton.onclick = createOffer;
  acceptOfferButton.onclick = acceptOffer;
  setIceButton.onclick = setIceCandidates;
  setAnswerButton.onclick = setAnswer;

  try {
    const enumerateDevices = await navigator.mediaDevices.enumerateDevices();
    gotSources(enumerateDevices);
  } catch (e) {
    console.log(e);
  }

  function gotSources(sourceInfos) {
    selectSourceDiv.classList.remove('hidden');
    let audioCount = 0;
    let videoCount = 0;
    for (let i = 0; i < sourceInfos.length; i++) {
      const option = document.createElement('option');
      option.value = sourceInfos[i].deviceId;
      option.text = sourceInfos[i].label;
      if (sourceInfos[i].kind === 'audioinput') {
        audioCount++;
        if (option.text === '') {
          option.text = `Audio ${audioCount}`;
        }
        audioSelect.appendChild(option);
      } else if (sourceInfos[i].kind === 'videoinput') {
        videoCount++;
        if (option.text === '') {
          option.text = `Video ${videoCount}`;
        }
        videoSelect.appendChild(option);
      }
    }
  }

  async function getMedia() {
    getMediaButton.disabled = true;
    createPeerConnectionButton.disabled = false;

    if (localStream) {
      localVideo.srcObject = null;
      localStream.getTracks().forEach(track => track.stop());
    }

    const audioSource = audioSelect.value;
    const videoSource = videoSelect.value;

    const constraints = {
      audio: {
        optional: [{
          sourceId: audioSource
        }]
      },
      video: {
        optional: [{
          sourceId: videoSource
        }]
      }
    };
    try {
      const userMedia = await navigator.mediaDevices.getUserMedia(constraints);
      gotStream(userMedia);
    } catch (e) {
      console.log('navigator.getUserMedia error: ', e);
    }
  }

  function gotStream(stream) {
    localVideo.srcObject = stream;
    localStream = stream;
    console.log("gotStream");
  }

  function createPeerConnection() {
    createPeerConnectionButton.disabled = true;
    createOfferButton.disabled = false;
    acceptOfferButton.disabled = false;

    const servers = null;
    window.peerConnection = peerConnection = new RTCPeerConnection(servers);
    peerConnection.onicecandidate = e => onIceCandidate(peerConnection, e);

    localStream.getTracks()
      .forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.addEventListener('connectionstatechange', event => {
      if (peerConnection.connectionState == 'connected') {
        remoteVideo.srcObject = remoteStream;
      }
    });

    peerConnection.addEventListener('track', async (event) => {
      console.log(event.track);
      remoteStream.addTrack(event.track, remoteStream);
    });
  }

  function onIceCandidate(pc, event) {
    if (!event.candidate) {
      return;
    }

    let candidates;
    if (iceTextarea.value == '') {
      candidates = [];
    }
    else {
      candidates = JSON.parse(iceTextarea.value);
    }

    candidates.push(event.candidate.toJSON());
    iceTextarea.value = JSON.stringify(candidates);
  }

  async function createOffer() {
    let description;
    try {
      description = await peerConnection.createOffer(offerOptions);
    } catch (e) {
      console.log(`Failed to create session description: ${e.toString()}`);
    }

    peerConnection.setLocalDescription(description);
    sdpTextarea.value = description.sdp;
    createOfferButton.disabled = true;
    acceptOfferButton.disabled = true;
    setAnswerButton.disabled = false;
    isCaller = true;
  }

  async function acceptOffer() {
    const sdp = sdpTextarea.value
      .split('\n')
      .map(l => l.trim())
      .join('\r\n');
    const offer = {
      type: 'offer',
      sdp: sdp
    };

    peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    let description;
    try {
      description = await peerConnection.createAnswer();
    } catch (e) {
      console.log(`Failed to create answer: ${e.toString()}`);
    }

    sdpTextarea.value = description.sdp;
    createOfferButton.disabled = true;
    acceptOfferButton.disabled = true;
    setAnswerButton.disabled = false;
    isCaller = false;
  }

  async function setIceCandidates(pc, event) {
    const candidates = JSON.parse(iceTextarea.value);
    for (let item of candidates) {
      let ice = new RTCIceCandidate(item);
      await peerConnection.addIceCandidate(ice);
    }
    setIceButton.disabled = true;
  }

  async function setAnswer() {
    const sdp = sdpTextarea.value
      .split('\n')
      .map(l => l.trim())
      .join('\r\n');
    const answer = {
      type: 'answer',
      sdp: sdp
    };

    try {
      if (isCaller) {
        await peerConnection.setRemoteDescription(answer);
      } else {
        await peerConnection.setLocalDescription(answer);
      }
    }
    catch (e) {
      console.log(`Failed to set answer: ${e.toString()}`);
    }

    setAnswerButton.disabled = true;
    setIceButton.disabled = false;
  }

}
